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
            const page = formData.get('page');
            const year = formData.get('year');
            const title = formData.get('title');
            const type = formData.get('type');
            const type2 = formData.get('type2');
            const testNumber = formData.get('testNumber');
            const simulation = formData.get('simulation');
            const county = formData.get('county');
            const local = formData.get('local');
            const file = formData.get('file') as unknown as File;

            if (!file || file.type !== 'application/pdf' || file.size > 50 * 1024 * 1024) {
                return new Response('Fișier invalid', { status: 400, headers: corsHeaders });
            }

            if (!isValidYear(year) || !isValidType(type) || !isValidType2(type2)) {
                return new Response('Parametri invalizi', { status: 400, headers: corsHeaders });
            }

            if (!isValidPage(page)) {
                return new Response('Pagina invalidă', { status: 400, headers: corsHeaders });
            }

            if (page === 'bac' && !isValidTitle(title)) {
                return new Response('Titlu invalid', { status: 400, headers: corsHeaders });
            }

            if (page === 'teste' && !isValidTestNumber(testNumber)) {
                return new Response('Număr test invalid', { status: 400, headers: corsHeaders });
            }

            if (page === 'sim' && !isValidSimulation(simulation)) {
                return new Response('Tip simulare invalid', { status: 400, headers: corsHeaders });
            }

            if (page === 'sim' && simulation === 'jud' && !isValidCounty(county)) {
                return new Response('Județ invalid', { status: 400, headers: corsHeaders });
            }

            if (page === 'sim' && simulation === 'loc' && !isValidLocal(local)) {
                return new Response('Localitate invalidă', { status: 400, headers: corsHeaders });
            }

            let storagePath = '';
            let newFileName = '';

            if (page === 'bac') {
                newFileName = `E_d_fizica_${year}_${type}_${type2}.pdf`;
                storagePath = `public/files/fizica/bac/${year}/${title}/${newFileName}`;
            } else if (page === 'teste') {
                newFileName = `E_d_fizica_${year}_${type2}_${testNumber}.pdf`;
                storagePath = `public/files/fizica/teste/${year}/-/${newFileName}`;
            } else if (page === 'sim') {
                const location = simulation === 'jud' ? county : local;
                newFileName = `E_d_fizica_${location}_${year}_${type2}.pdf`;
                storagePath = `public/files/fizica/simulari/${year}-simulari-${simulation}/${newFileName}`;
            } else {
                return new Response('Pagina invalidă', { status: 400, headers: corsHeaders });
            }

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

function isValidType(type: any): boolean {
    const validTypes = ['model', 'simulare', 'test', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
    return validTypes.includes(type);
}

function isValidType2(type2: any): boolean {
    const validTypes = ['var', 'bar'];
    return validTypes.includes(type2);
}

function isValidPage(page: any): boolean {
    const validPages = ['bac', 'teste', 'sim'];
    return validPages.includes(page);
}

function isValidTitle(title: any): boolean {
    const validTitles = ['Simulare', 'Model', 'Sesiunea-I', 'Sesiunea-II', 'Sesiune-Olimpici', 'Rezerva'];
    return validTitles.includes(title);
}

function isValidTestNumber(testNumber: any): boolean {
    const testNumberRegex = /^\d{1,2}$/;
    return testNumberRegex.test(testNumber);
}

function isValidSimulation(simulation: any): boolean {
    const validSimulations = ['jud', 'loc'];
    return validSimulations.includes(simulation);
}

function isValidCounty(county: any): boolean {
    const validCounties = [
        'Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud', 'Botoșani', 'Brașov', 'Brăila', 'Buzău',
        'Caraș-Severin', 'Călărași', 'Cluj', 'Constanța', 'Covasna', 'Dâmbovița', 'Dolj', 'Galați', 'Giurgiu',
        'Gorj', 'Harghita', 'Hunedoara', 'Ialomița', 'Iași', 'Ilfov', 'Maramureș', 'Mehedinți', 'Mureș', 'Neamț',
        'Olt', 'Prahova', 'Satu Mare', 'Sălaj', 'Sibiu', 'Suceava', 'Teleorman', 'Timiș', 'Tulcea', 'Vaslui',
        'Vâlcea', 'Vrancea', 'București'
    ];
    return validCounties.includes(county);
}

function isValidLocal(local: any): boolean {
    return typeof local === 'string' && local.trim().length > 0;
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

async function createPullRequest(storagePath: string, file: File, newFileName: string) {
    const octokit = new Octokit({
        // @ts-ignore
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