import { Octokit } from "@octokit/rest";

// Types for upload functionality
export interface UploadFormData {
    page: string;
    year: string;
    title: string;
    type: string;
    type2: string;
    testNumber: string;
    simulation: string;
    county: string;
    local: string;
    file: File;
}

export interface FilePath {
    storagePath: string;
    newFileName: string;
}

// Environment bindings for upload
export interface UploadEnv {
    UPLOAD_PASSWORD: string;
    GITHUB_TOKEN: string;
    CUZA_FILES: R2Bucket;
}

export function validateFormData(formData: FormData): string | null {
    const page = formData.get('page') as string;
    const year = formData.get('year') as string;
    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const type2 = formData.get('type2') as string;
    const testNumber = formData.get('testNumber') as string;
    const simulation = formData.get('simulation') as string;
    const county = formData.get('county') as string;
    const local = formData.get('local') as string;
    const file = formData.get('file') as unknown as File;

    if (!page || !year || !type || !type2 || !file) {
        return 'Câmpuri obligatorii lipsă';
    }

    if (page === 'bac' && !title) {
        return 'Lipsă titlu pentru pagina bac';
    }

    if (page === 'teste' && !testNumber) {
        return 'Lipsă număr test pentru pagina teste';
    }

    if (page === 'sim') {
        if (!simulation) {
            return 'Lipsă tip simulare pentru pagina sim';
        }
        if (simulation === 'judetene' && !county) {
            return 'Lipsă județ pentru simulare județeană';
        }
        if (simulation === 'locale' && !local) {
            return 'Lipsă localitate pentru simulare locală';
        }
    }

    return null;
}

export function extractFormData(formData: FormData): UploadFormData {
    return {
        page: formData.get('page') as string,
        year: formData.get('year') as string,
        title: formData.get('title') as string,
        type: formData.get('type') as string,
        type2: formData.get('type2') as string,
        testNumber: formData.get('testNumber') as string,
        simulation: formData.get('simulation') as string,
        county: formData.get('county') as string,
        local: formData.get('local') as string,
        file: formData.get('file') as unknown as File
    };
}

export function generateFilePath(page: string, year: string, title: string, type: string, type2: string, testNumber: string = '', simulation: string = '', county: string = '', local: string = ''): FilePath {
    let storagePath = '';
    let newFileName = '';

    if (page === 'bac') {
        newFileName = `E_d_fizica_${year}_${type}_${type2}.pdf`;
        storagePath = `files/fizica/pages/bac/${year}/${title}/${newFileName}`;
    } else if (page === 'teste') {
        newFileName = `E_d_fizica_${year}_${type2}_${testNumber}.pdf`;
        storagePath = `files/fizica/pages/teste-de-antrenament/${year}/${newFileName}`;
    } else if (page === 'sim') {
        const location = simulation === 'judetene' ? county : local;
        newFileName = `E_d_fizica_${location}_${year}_${type2}.pdf`;
        storagePath = `files/fizica/pages/simulari-judetene/${year}/${newFileName}`;
    }

    return { storagePath, newFileName };
}

export async function uploadToR2AndGithub(
    env: UploadEnv,
    storagePath: string,
    file: File,
    newFileName: string,
    page: string,
    type: string
): Promise<void> {
    // Upload to R2 bucket
    const fileContent = await file.arrayBuffer();
    await env.CUZA_FILES.put(storagePath, fileContent, {
        httpMetadata: {
            contentType: 'application/pdf',
            contentDisposition: `inline; filename="${newFileName}"`
        }
    });

    // Also create GitHub PR for backup/versioning
    await createPullRequest(env.GITHUB_TOKEN, storagePath, file, newFileName, page, type);
}

async function createPullRequest(githubToken: string, storagePath: string, file: File, newFileName: string, page: string, type: string) {
    const octokit = new Octokit({
        auth: githubToken
    });

    const owner = 'dynow';
    const repo = 'cuza.pages.dev';
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    let index = 1;
    let branchName = `upload-${year}-${month}-${day}-${String(index).padStart(2, '0')}`;
    const baseBranch = 'main';

    try {
        // Get the SHA of the base branch
        const { data: { object: { sha: baseSha } } } = await octokit.git.getRef({
            owner,
            repo,
            ref: `heads/${baseBranch}`
        });

        // Check if branch already exists and increment index if it does
        while (true) {
            try {
                await octokit.git.getRef({
                    owner,
                    repo,
                    ref: `heads/${branchName}`
                });
                // Branch exists, increment index and update branch name
                index++;
                branchName = `upload-${year}-${month}-${day}-${String(index).padStart(2, '0')}`;
            } catch (error) {
                // Branch does not exist, break the loop
                break;
            }
        }

        // Create a new branch
        await octokit.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branchName}`,
            sha: baseSha
        });

        // Read the file content
        const fileContent = await file.arrayBuffer();
        const uint8Array = new Uint8Array(fileContent);

        // Convert Uint8Array to base64 properly using chunked processing
        const chunkSize = 8192;
        let binary = '';
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.slice(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, Array.from(chunk));
        }

        // Encode the binary string to Base64
        const content = btoa(binary);

        // Create a new file in the new branch
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: storagePath,
            message: `Upload ${newFileName}`,
            content,
            branch: branchName
        });

        // Modify the type if it includes numbers
        const mtype = /\d/.test(type) ? 'varianta' : type.toLocaleLowerCase();

        // Create a pull request
        const { data: pullRequest } = await octokit.pulls.create({
            owner,
            repo,
            title: `Upload ${newFileName}`,
            head: branchName,
            base: baseBranch,
            body: `This PR uploads the (*${mtype}*) **${newFileName}** to the path:\n\`${storagePath}\`\nOld name: *${file.name}*`
        });

        // Automatically merge the pull request
        await octokit.pulls.merge({
            owner,
            repo,
            pull_number: pullRequest.number,
            merge_method: 'merge'
        });

        // Delete the branch
        await octokit.git.deleteRef({
            owner,
            repo,
            ref: `heads/${branchName}`
        });
    } catch (error) {
        console.error('Error creating pull request:', error);
        throw error;
    }
}

export function isValidAuth(authHeader: string, uploadPassword: string): boolean {
    const encoded = authHeader.split(' ')[1];
    if (!encoded) {
        return false;
    }
    const decoded = atob(encoded);
    const [username, password] = decoded.split(':');
    return password === uploadPassword;
}
