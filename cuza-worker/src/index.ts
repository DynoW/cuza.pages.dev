import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Octokit } from '@octokit/rest';

// 1. Define Environment Bindings (Secrets)
type Bindings = {
  UPLOAD_PASSWORD: string;
  GITHUB_TOKEN: string;
};

// 2. Initialize Hono
const app = new Hono<{ Bindings: Bindings }>();

// 3. Setup CORS Middleware
app.use('*', cors({
  origin: (origin) => {
    const allowedOrigins = ['https://cuza.pages.dev', 'http://localhost:4321'];
    return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  },
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

// 4. Main Route
app.post('/', async (c) => {
  // --- Authentication Check ---
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !isValidAuth(authHeader, c.env.UPLOAD_PASSWORD)) {
    console.log('Authorization failed');
    return c.text('Neautorizat', 401);
  }

  // --- Content-Type Check ---
  const contentType = c.req.header('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    console.log('Invalid content type:', contentType);
    return c.text('Tip de conținut neacceptat', 415);
  }

  // --- Form Data Parsing ---
  let formData: FormData;
  try {
    // Hono's `c.req.parseBody` can handle parsing, but `raw.formData()` is safer for strict FormData types
    formData = await c.req.raw.formData();
  } catch (e) {
    return c.text('Eroare la citirea datelor', 400);
  }

  // --- Validation ---
  const validationError = validateFormData(formData);
  if (validationError) {
    console.log('Validation error:', validationError);
    return c.text(`Date lipsă: ${validationError}`, 400);
  }

  // --- Data Extraction & Path Generation ---
  const data = extractFormData(formData);
  const { storagePath, newFileName } = generateFilePath(data);

  // --- GitHub Processing ---
  try {
    await createPullRequest(c.env.GITHUB_TOKEN, storagePath, data.file, newFileName, data.page, data.type);
    return c.text('Fișier încărcat cu succes', 200);
  } catch (error) {
    console.log('Error creating pull request:', error);
    return c.text('Eroare la crearea pull request-ului', 500);
  }
});

// --- Helper Functions ---

function isValidAuth(authHeader: string, actualPassword: string): boolean {
  const parts = authHeader.split(' ');
  if (parts.length !== 2) return false;
  
  const encoded = parts[1];
  try {
    const decoded = atob(encoded);
    const [username, password] = decoded.split(':');
    return password === actualPassword;
  } catch (e) {
    return false;
  }
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
  const file = formData.get('file');

  if (!page || !year || !type || !type2 || !file) {
    return 'Câmpuri obligatorii lipsă';
  }

  if (page === 'bac' && !title) return 'Lipsă titlu pentru pagina bac';
  if (page === 'teste' && !testNumber) return 'Lipsă număr test pentru pagina teste';

  if (page === 'sim') {
    if (!simulation) return 'Lipsă tip simulare pentru pagina sim';
    if (simulation === 'judetene' && !county) return 'Lipsă județ pentru simulare județeană';
    if (simulation === 'locale' && !local) return 'Lipsă localitate pentru simulare locală';
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

function generateFilePath(data: ReturnType<typeof extractFormData>) {
  const { page, year, title, type, type2, testNumber, simulation, county, local } = data;
  let storagePath = '';
  let newFileName = '';

  if (page === 'bac') {
    newFileName = `E_d_fizica_teoretic_vocational_${year}_${type2}_${type}.pdf`;
    storagePath = `files/fizica/bac/${year}/${title}/${newFileName}`;
  } else if (page === 'teste') {
    newFileName = `E_d_fizica_${year}_${type2}_${testNumber}.pdf`;
    storagePath = `files/fizica/teste-de-antrenament/${year}/${newFileName}`;
  } else if (page === 'sim') {
    const location = simulation === 'judetene' ? county : local;
    newFileName = `E_d_fizica_${location}_${year}_${type2}.pdf`;
    storagePath = `files/fizica/simulari-judetene/${year}/${newFileName}`;
  }

  return { storagePath, newFileName };
}

async function createPullRequest(token: string, storagePath: string, file: File, newFileName: string, page: string, type: string) {
  const octokit = new Octokit({ auth: token });
  const owner = 'dynow';
  const repo = 'cuza.pages.dev';
  
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const baseBranch = 'main';

  // --- Generate Unique Branch Name ---
  let index = 1;
  let branchName = `upload-${year}-${month}-${day}-${String(index).padStart(2, '0')}`;
  
  // Get Base SHA
  const { data: { object: { sha: baseSha } } } = await octokit.git.getRef({
    owner, repo, ref: `heads/${baseBranch}`
  });

  // Find unique branch name (increment index if exists)
  while (true) {
    try {
      await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` });
      index++;
      branchName = `upload-${year}-${month}-${day}-${String(index).padStart(2, '0')}`;
    } catch {
      break; // Branch doesn't exist, we can use this name
    }
  }

  // Create Branch
  await octokit.git.createRef({
    owner, repo, ref: `refs/heads/${branchName}`, sha: baseSha
  });
  console.log('Created new branch:', branchName);

  // Prepare File Content (Base64 encoding)
  const fileContent = await file.arrayBuffer();
  const uint8Array = new Uint8Array(fileContent);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(uint8Array.slice(i, i + chunkSize)));
  }
  const content = btoa(binary);

  // Create File
  await octokit.repos.createOrUpdateFileContents({
    owner, repo, path: storagePath, message: `Upload ${newFileName}`,
    content, branch: branchName
  });

  // Determine type description
  const mtype = /\d/.test(type) ? 'varianta' : type.toLocaleLowerCase();

  // Create PR
  const { data: pullRequest } = await octokit.pulls.create({
    owner, repo, title: `Upload ${newFileName}`, head: branchName, base: baseBranch,
    body: `This PR uploads the (*${mtype}*) **${newFileName}** to the path:\n\`${storagePath}\`\nOld name: *${file.name}*`
  });

  // Merge PR
  await octokit.pulls.merge({
    owner, repo, pull_number: pullRequest.number, merge_method: 'merge'
  });

  // Delete Branch
  await octokit.git.deleteRef({
    owner, repo, ref: `heads/${branchName}`
  });
  
  console.log('Branch deleted, process complete.');
}

export default app;