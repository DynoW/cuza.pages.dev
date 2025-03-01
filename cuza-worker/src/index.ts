import { Octokit } from "@octokit/rest";

const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://cuza.pages.dev',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return handleOptions();
    }

    if (request.method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !isValidAuth(authHeader)) {
            console.log('Authorization failed');
            return new Response('Neautorizat', { status: 401, headers: corsHeaders });
        }

        const contentType = request.headers.get('Content-Type') || '';
        if (!contentType.includes('multipart/form-data')) {
            console.log('Invalid content type:', contentType);
            return new Response('Tip de conținut neacceptat', { status: 415, headers: corsHeaders });
        }

        const formData = await request.formData();
        const validationError = validateFormData(formData);
        if (validationError) {
            console.log('Validation error:', validationError);
            return new Response(`Date lipsă: ${validationError}`, { status: 400, headers: corsHeaders });
        }

        const { page, year, title, type, type2, testNumber, simulation, county, local, file } = extractFormData(formData);

        const { storagePath, newFileName } = generateFilePath(page, year, title, type, type2, testNumber, simulation, county, local);

        try {
            await createPullRequest(storagePath, file, newFileName, page, type);
            return new Response('Fișier încărcat cu succes', { status: 200, headers: corsHeaders });
        } catch (error) {
            console.log('Error creating pull request:', error);
            return new Response('Eroare la crearea pull request-ului', { status: 500, headers: corsHeaders });
        }
    }

    return new Response('Metodă nepermisă', { status: 405, headers: corsHeaders });
}

function handleOptions(): Response {
    return new Response(null, {
        status: 204,
        headers: corsHeaders
    });
}

function isValidAuth(authHeader: string): boolean {
    const encoded = authHeader.split(' ')[1];
    if (!encoded) {
        return false;
    }
    const decoded = atob(encoded);
    const [username, password] = decoded.split(':');
    // @ts-ignore
    return password === UPLOAD_PASSWORD;
}

function validateFormData(formData: FormData): string | null {
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

function extractFormData(formData: FormData) {
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

function generateFilePath(page: string, year: string, title: string, type: string, type2: string, testNumber: string = '', simulation: string = '', county: string = '', local: string = '') {
    let storagePath = '';
    let newFileName = '';

    if (page === 'bac') {
        newFileName = `E_d_fizica_${year}_${type}_${type2}.pdf`;
        storagePath = `public/files/fizica/bac/${year}/${title}/${newFileName}`;
    } else if (page === 'teste') {
        newFileName = `E_d_fizica_${year}_${type2}_${testNumber}.pdf`;
        storagePath = `public/files/fizica/teste/${year}/-/${newFileName}`;
    } else if (page === 'sim') {
        const location = simulation === 'judetene' ? county : local;
        newFileName = `E_d_fizica_${location}_${year}_${type2}.pdf`;
        storagePath = `public/files/fizica/simulari/${year}-simulari-${simulation}/-/${newFileName}`;
    }

    return { storagePath, newFileName };
}

async function createPullRequest(storagePath: string, file: File, newFileName: string, page: string, type: string) {
    const octokit = new Octokit({
        // @ts-ignore
        auth: GITHUB_TOKEN
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
        console.log('Base branch SHA:', baseSha);

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
        console.log('Created new branch:', branchName);

        // Read the file content
        const fileContent = await file.arrayBuffer();
        const uint8Array = new Uint8Array(fileContent);

        // Build the binary string in chunks
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
            if (uint8Array[i] !== undefined) {
                binary += String.fromCharCode(uint8Array[i] as number);
            }
        }

        // Encode the binary string to Base64
        const content = btoa(binary);

        console.log('File content encoded to base64');

        // Create a new file in the new branch
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: storagePath,
            message: `Upload ${newFileName}`,
            content,
            branch: branchName
        });
        console.log('File created in new branch:', storagePath);

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
        console.log('Pull request created');

        // Automatically merge the pull request
        await octokit.pulls.merge({
            owner,
            repo,
            pull_number: pullRequest.number,
            merge_method: 'merge'
        });
        console.log('Pull request merged');

        // Delete the branch
        await octokit.git.deleteRef({
            owner,
            repo,
            ref: `heads/${branchName}`
        });
        console.log('Branch deleted');
    } catch (error) {
        console.error('Error creating pull request:', error);
        throw error;
    }
}