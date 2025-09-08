# Cuza Worker - R2 File Management

This Cloudflare Worker provides R2 bucket integration for the cuza.pages.dev project, enabling file storage, retrieval, and dynamic content generation.

## Features

- **File Upload**: Upload PDF files to R2 bucket with automatic GitHub backup
- **File Serving**: Serve files directly from R2 with proper caching headers
- **Dynamic File Listing**: Generate structured JSON of all files for build-time consumption
- **Folder Structure**: Maintain organized folder hierarchy matching the original `/files` structure

## API Endpoints

### GET /files
Returns a structured JSON object containing all files in the R2 bucket organized by folder hierarchy.

**Response Format:**
```json
{
  "files": {
    "fizica": {
      "pages": {
        "bac": {
          "2024": {
            "filename.pdf": ["files", "fizica", "pages", "bac", "2024", "filename.pdf"]
          }
        }
      },
      "extra": {
        "document.pdf": ["files", "fizica", "extra", "document.pdf"]
      }
    }
  }
}
```

### GET /files/{path}
Serves individual files from the R2 bucket.

**Example:**
- `/files/files/fizica/pages/bac/2024/test.pdf`

**Features:**
- Proper Content-Type headers
- 24-hour caching
- Content-Disposition headers for inline viewing

### POST /upload
Upload new files to the R2 bucket and create GitHub backup.

**Authentication:** Basic Auth (same as before)
**Content-Type:** multipart/form-data

## Deployment

1. **Set up R2 Bucket:**
   ```bash
   # Create R2 bucket named "cuza-bucket"
   wrangler r2 bucket create cuza-bucket
   ```

2. **Configure Environment Variables:**
   ```bash
   # Set secrets
   wrangler secret put UPLOAD_PASSWORD
   wrangler secret put GITHUB_TOKEN
   ```

3. **Deploy Worker:**
   ```bash
   cd cuza-worker
   wrangler deploy
   ```

## File Structure Migration

To migrate existing files from `/files` directory to R2:

```bash
# Use wrangler to bulk upload
wrangler r2 object put cuza-bucket/files/fizica/pages/bac/2024/test.pdf --file ./files/fizica/pages/bac/2024/test.pdf
```

Or use the R2 dashboard for bulk operations.

## Frontend Integration

The Astro frontend uses `NewContent.astro` component which:

1. **Build-time Fetch**: Fetches file structure from worker during build
2. **Client-side Rendering**: Renders folder trees with expand/collapse functionality
3. **File Links**: Points directly to worker endpoints for file access
4. **Fallback**: Gracefully handles worker unavailability

### Component Usage

```astro
<NewContent 
  subject="fizica" 
  page="bac" 
  workerUrl="https://cuza-worker.dynow.workers.dev" 
/>
```

## Configuration

### wrangler.toml
```toml
# R2 Bucket Bindings
[[r2_buckets]]
binding = "CUZA_FILES"
bucket_name = "cuza-bucket"

# Environment variables
[vars]
GITHUB_OWNER = "dynow"
GITHUB_REPO = "cuza.pages.dev"
```

### Environment Variables

- `UPLOAD_PASSWORD`: Password for file upload authentication
- `GITHUB_TOKEN`: GitHub token for backup PR creation
- `CUZA_FILES`: R2 bucket binding (configured in wrangler.toml)

## Development

### Local Development
```bash
cd cuza-worker
wrangler dev
```

### Testing Endpoints
```bash
# Test file listing
curl https://???-worker.???.workers.dev/files

# Test file serving
curl https://???-worker.???.workers.dev/files/files/fizica/pages/bac/2024/test.pdf
```

## Migration Notes

1. **File Paths**: Updated to match new structure with `/files` prefix
2. **Upload Logic**: Moved to `upload.ts` for better organization
3. **Content Component**: `NewContent.astro` replaces `Content.jsx`
4. **Build Integration**: Files fetched at build time instead of bundled

## Caching Strategy

- **File Listing**: 5 minutes cache (frequently updated)
- **File Serving**: 24 hours cache (files rarely change)
- **CORS**: Enabled for all origins to support build-time fetching

## Error Handling

- Graceful fallback when worker is unavailable
- Console warnings for debugging
- Error messages displayed to users when appropriate
