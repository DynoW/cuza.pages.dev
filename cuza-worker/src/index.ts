import { Octokit } from "@octokit/rest";

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return handleOptions(request);
    }

    if (request.method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !isValidAuth(authHeader)) {
            return new Response('Neautorizat', { status: 401, headers: corsHeaders });
        }

        try {
            const formData = await request.formData();
            const year = formData.get('year');
            const type1 = formData.get('type1');
            const type2 = formData.get('type2');
            const file = formData.get('file') as unknown as File;

            if (!file || file.type !== 'application/pdf' || file.size > 50 * 1024 * 1024) {
                return new Response('Fișier invalid', { status: 400, headers: corsHeaders });
            }

            if (!isValidYear(year) || !isValidType1(type1) || !isValidType2(type2)) {
                return new Response('Parametri invalizi', { status: 400, headers: corsHeaders });
            }

            const newFileName = `E_d_fizica_${year}_${type1}_${type2}.pdf`;
            const storagePath = `public/files/fizica/bac/${year}/${type1}/${newFileName}`;

            await createPullRequest(storagePath, file, newFileName);
            return new Response('Fișier încărcat cu succes!', { status: 200, headers: corsHeaders });
        } catch (error) {
            console.error('Eroare la procesarea cererii:', error);
            return new Response('Eroare la încărcarea fișierului', { status: 500, headers: corsHeaders });
        }
    }

    return new Response('Metodă nepermisă', { status: 405, headers: corsHeaders });
}

function handleOptions(request: Request): Response {
    return new Response(null, {
        status: 204,
        headers: corsHeaders
    });
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function isValidYear(year: any): boolean {
    const yearRegex = /^\d{4}$/;
    return yearRegex.test(year);
}

function isValidType1(type1: any): boolean {
    const validTypes = ['model', 'simulare', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
    return validTypes.includes(type1);
}

function isValidType2(type2: any): boolean {
    const validTypes = ['var', 'bar'];
    return validTypes.includes(type2);
}

function isValidAuth(authHeader: string): boolean {
    const encoded = authHeader.split(' ')[1];
    const decoded = atob(encoded);
    const [username, password] = decoded.split(':');
    return password === UPLOAD_PASSWORD;
}

async function createPullRequest(storagePath: string, file: File, newFileName: string) {
    const octokit = new Octokit({
        auth: GITHUB_TOKEN
    });

    const owner = 'dynow';
    const repo = 'cuza.pages.dev';
    const branchName = `upload-${Date.now()}`;
    const baseBranch = 'main';

    try {
        // Get the SHA of the base branch
        const { data: { object: { sha: baseSha } } } = await octokit.git.getRef({
            owner,
            repo,
            ref: `heads/${baseBranch}`
        });
        console.log('Base branch SHA:', baseSha);

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
            binary += String.fromCharCode(uint8Array[i]);
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

        // Create a pull request
        await octokit.pulls.create({
            owner,
            repo,
            title: `Upload ${newFileName}`,
            head: branchName,
            base: baseBranch,
            body: `This PR uploads the file ${newFileName} to the path ${storagePath}\nOld file name: ${file.name}`
        });
        console.log('Pull request created');
    } catch (error) {
        console.error('Error creating pull request:', error);
        throw error;
    }
}