#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Daniel C. (DynoW) — https://github.com/DynoW/cuza.pages.dev
"""
Web scraper for Romanian Baccalaureate exam files from subiecte.edu.ro
Downloads and uploads exam PDFs to R2 via the cuza-worker API.
"""

import argparse
import os
import re
import shutil
import zipfile
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse
import requests


class BacExamScraper:
    def __init__(self, worker_url: str, upload_password: str, year: int = None):
        self.worker_url = worker_url.rstrip('/')
        self.upload_password = upload_password

        self.web_scraper_dir = Path(__file__).parent
        self.seen_urls_file = self.web_scraper_dir / "seen_urls.txt"
        self.temp_dir = self.web_scraper_dir / "temp"
        
        self.current_year = str(year) if year else str(datetime.now().year)
        
        # URL patterns for the current year
        self.archive_on = True
        self.set_archive = self.current_year if self.archive_on else ""

        self.urls = [
            f"http://subiecte{self.set_archive}.edu.ro/{self.current_year}/bacalaureat/modeledesubiecte/probescrise/",
            f"http://subiecte{self.set_archive}.edu.ro/{self.current_year}/simulare/simulare_bac_XII/",
            f"http://subiecte{self.set_archive}.edu.ro/{self.current_year}/bacalaureat/Subiecte_si_bareme/"
        ]
        
        # Load previously seen URLs
        self.seen_urls = self.load_seen_urls()
        
    def load_seen_urls(self) -> set:
        """Load previously processed URLs from file."""
        if self.seen_urls_file.exists():
            with open(self.seen_urls_file, 'r', encoding='utf-8') as f:
                return set(line.strip() for line in f if line.strip())
        return set()
    
    def save_seen_urls(self):
        """Save processed URLs to file."""
        with open(self.seen_urls_file, 'w', encoding='utf-8') as f:
            for url in sorted(self.seen_urls):
                f.write(url + '\n')
    
    def fetch_page(self, url: str) -> str:
        """Fetch webpage content."""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            print(f"Error fetching {url}: {e}")
            return ""
    
    def extract_links(self, html_content: str, base_url: str) -> list:
        """Extract ZIP file links matching the exam pattern."""
        # Multiple patterns to match different ZIP file formats:
        # 1. Standard: E_[acd]_...2025...zip
        # 2. Model: Bac_2025_E_[acd]_...zip  
        # 3. Various other formats with year
        patterns = [
            rf'href=\"([^\"]*E_[acd]_[^\"]*{self.current_year}[^\"]*\.zip)\"',
            rf'href=\"([^\"]*Bac_{self.current_year}_E_[acd]_[^\"]*\.zip)\"',
            rf'href=\"([^\"]*{self.current_year}[^\"]*E_[acd][^\"]*\.zip)\"',
        ]
        
        all_matches = []
        for pattern in patterns:
            matches = re.findall(pattern, html_content, re.IGNORECASE)
            all_matches.extend(matches)
        
        # Convert relative URLs to absolute
        zip_links = []
        for match in all_matches:
            if match.startswith('http') or match.startswith('https'):
                zip_links.append(match)
            else:
                zip_links.append(urljoin(base_url, match))
        
        return list(set(zip_links))  # Remove duplicates
    
    def determine_exam_type(self, url: str, zip_filename: str = "") -> str:
        """Determine the exam type based on URL and filename."""
        url_lower = url.lower()
        filename_lower = zip_filename.lower()
        
        # Check url for exam type indicators first
        if 'simulare' in url_lower or 'sim' in filename_lower:
            return 'Simulare'
        
        if 'modeledesubiecte' in url_lower or 'model' in filename_lower:
            return 'Model'
        
        # For regular bac URL, determine based on filename patterns
        if 'rezerva' in filename_lower:
            if 'speciala' in filename_lower:
                return 'Sesiune-olimpici-rezerva'
            if 'iun' in filename_lower or 'iul' in filename_lower:
                return 'Sesiunea-I-rezerva'
            if 'aug' in filename_lower:
                return 'Sesiunea-II-rezerva'
        if 'speciala' in filename_lower:
            return 'Sesiune-olimpici'
        if '_iun' in filename_lower or '_iul' in filename_lower:
            return 'Sesiunea-I'  # June session
        if '_aug' in filename_lower:
            return 'Sesiunea-II'  # August session
        
        # Default fallback
        return '-'
    
    def download_file(self, url: str, target_path: Path) -> bool:
        """Download file from URL to target path."""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(url, headers=headers, timeout=60)
            response.raise_for_status()
            
            with open(target_path, 'wb') as f:
                f.write(response.content)
            
            print(f"Downloaded: {target_path.name}")
            return True
        except requests.RequestException as e:
            print(f"Error downloading {url}: {e}")
            return False

    # ── Subject & subcategory extraction ────────────────────────────────────────

    def extract_subject_from_pdf_name(self, pdf_filename: str) -> str:
        """Extract subject from PDF filename to determine correct folder."""
        filename_lower = pdf_filename.lower()
        
        # Map keywords in filename to subject folders
        subject_keywords = {
            # e_a_
            'romana': 'romana', # fara "pentru": real/uman | E_a_romana_real_tehn_2025_var_model.pdf
            # e_c_
            'matematica': 'mate', # LRO: mate-info/pedagogic/st-nat/tehnologic | E_c_matematica_M_mate-info_2025_var_model_LRO.pdf
            'istorie': 'istorie', # LRO | E_c_istorie_2025_var_simulare_LRO.pdf
            # e_d_
            'anat_fiz_gen_ec_um': 'anat', # LRO | E_d_anat_fiz_gen_ec_um_2025_var_model_LRO.pdf
            'bio_veg_anim': 'bio', # LRO | E_d_bio_veg_anim_2025_var_model_LRO.pdf
            'chimie': 'chimie', # LRO: anorganica/organica | E_d_chimie_anorganica_2025_var_model_LRO.pdf
            'economie': 'economie', # LRO | E_d_economie_2025_var_model_LRO.pdf
            'filosofie': 'filosofie', # LRO | E_d_filosofie_2025_var_model_LRO.pdf
            'fizica': 'fizica', # LRO: tehnologic/teoretic | E_d_fizica_teoretic_vocational_2025_var_model_LRO.pdf
            'geografie': 'geo', # LRO | E_d_geografie_2025_var_model_LRO.pdf
            'informatica': 'info', # LRO: MI/SN doar pt varianta are si C/Pascal | E_d_informatica_2025_sp_MI_C_var_model_LRO.pdf
            'logica': 'logica', # LRO | E_d_logica_2025_var_model_LRO.pdf
            'psihologie': 'psihologie', # LRO | E_d_psihologie_2025_var_model_LRO.pdf
            'sociologie': 'sociologie', # LRO | E_d_sociologie_2025_var_model_LRO.pdf
        }
        
        # Check for exact matches first, then partial matches
        for keyword, folder in subject_keywords.items():
            if keyword in filename_lower:
                return folder
        
        return None

    def extract_subcategory_from_pdf_name(self, pdf_filename: str) -> str:
        """Extract subcategory from PDF filename."""
        filename_lower = pdf_filename.lower()
        
        # Define subcategory keywords
        subcategory_keywords = {
            'real_tehn': 'real',
            'uman_ped': 'uman',
            'm_mate-info': 'mate-info',
            'm_pedagogic': 'pedagogic',
            'm_st-nat': 'st-nat',
            'm_tehnologic': 'tehnologic',
            'anorganica': 'anorganica',
            'organica': 'organica',
            'tehnologic': 'tehnologic',
            'teoretic_vocational': 'teoretic',
            'sp_mi_c': 'mate-info-C',
            'sp_mi_p': 'mate-info-Pascal',
            'sp_mi_pascal': 'mate-info-Pascal',
            'sp_sn_c': 'st-nat-C',
            'sp_sn_p': 'st-nat-Pascal',
            'sp_sn_pascal': 'st-nat-Pascal',
            'sp_mi_bar': 'mate-info-bareme',
            'sp_sn_bar': 'st-nat-bareme',
        }
        
        for keyword, folder in subcategory_keywords.items():
            if keyword in filename_lower:
                return folder
        
        return 'bac'

    # ── R2 upload ───────────────────────────────────────────────────────────────

    def build_r2_key(self, pdf_filename: str, exam_type: str, year: str) -> str:
        """Build the R2 object key for a PDF file."""
        filename = pdf_filename
        # Clean up filename by removing language suffixes
        clean_filename = filename
        language_suffixes = ['_LRO', '_LMA', '_LGE', '_LSK', '_LSR', '_LUA']
        for suffix in language_suffixes:
            if suffix + '.pdf' in clean_filename:
                clean_filename = clean_filename.replace(suffix + '.pdf', '.pdf')
                break

        # Extract subject from filename
        subject = self.extract_subject_from_pdf_name(filename)
        if not subject:
            return None, None
        
        subcategory = self.extract_subcategory_from_pdf_name(filename)
        r2_key = f"{subject}/pages/{subcategory}/{year}/{exam_type}/{clean_filename}"
        return r2_key, clean_filename

    def upload_to_r2(self, pdf_path: Path, r2_key: str) -> bool:
        """Upload a PDF file to R2 via the worker API."""
        try:
            with open(pdf_path, 'rb') as f:
                response = requests.post(
                    f"{self.worker_url}/upload-scraper",
                    files={'file': (pdf_path.name, f, 'application/pdf')},
                    data={
                        'password': self.upload_password,
                        'key': r2_key,
                    },
                    timeout=120,
                )
            if response.ok:
                print(f"  Uploaded to R2: {r2_key}")
                return True
            else:
                print(f"  Upload failed ({response.status_code}): {response.text}")
                return False
        except requests.RequestException as e:
            print(f"  Upload error: {e}")
            return False

    def upload_pdf(self, pdf_path: Path, exam_type: str, year: str) -> bool:
        """Upload a single PDF to R2 with the correct key."""
        filename = pdf_path.name
        r2_key, clean_filename = self.build_r2_key(filename, exam_type, year)
        if not r2_key:
            print(f"Warning: Could not determine subject for: {filename}")
            return False

        subcategory = self.extract_subcategory_from_pdf_name(filename)

        # Handle bareme files that need to go to both C and Pascal
        if subcategory in ('mate-info-bareme', 'st-nat-bareme'):
            new_sub = subcategory.replace('bareme', '')
            c_key = r2_key.replace(subcategory, new_sub + 'C')
            pascal_key = r2_key.replace(subcategory, new_sub + 'Pascal')
            ok_c = self.upload_to_r2(pdf_path, c_key)
            ok_p = self.upload_to_r2(pdf_path, pascal_key)
            return ok_c or ok_p

        return self.upload_to_r2(pdf_path, r2_key)

    # ── ZIP processing ───────────────────────────────────────────────────────────

    def extract_zip_file(self, zip_path: Path, target_temp_dir: Path, exam_type: str) -> list:
        """Extract ZIP file and upload PDFs to R2."""
        uploaded_files = []
        temp_extract_dir = target_temp_dir / f"temp_{zip_path.stem}"
        temp_extract_dir.mkdir(exist_ok=True)
        
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # Process each file in the ZIP
                pdf_files = []
                for zip_info in zip_ref.filelist:
                    if zip_info.filename.lower().endswith('.pdf') and zip_info.file_size > 0:
                        try:
                            zip_ref.extract(zip_info, temp_extract_dir)
                            pdf_path_extracted = temp_extract_dir / zip_info.filename
                            if pdf_path_extracted.exists() and pdf_path_extracted.is_file() and pdf_path_extracted.stat().st_size > 0:
                                pdf_files.append(pdf_path_extracted)
                        except Exception as e:
                            print(f"Error extracting {zip_info.filename}: {e}")
                            continue
                
                print(f"Found {len(pdf_files)} PDF files in {zip_path.name}")
                
                # Filter for LRO (Romanian) files only
                lro_files = [f for f in pdf_files if 
                           ('_LRO.pdf' in f.name or (not any(lang in f.name for lang in ['_LMA', '_LGE', '_LSK', '_LSR', '_LUA']) and f.name.endswith('.pdf'))) 
                           and 'pentru_minoritatea' not in f.name.lower() 
                           and 'minoritatea' not in f.name.lower()]
                print(f"Processing {len(lro_files)} LRO files")
                
                for pdf_file in lro_files:
                    try:
                        if self.upload_pdf(pdf_file, exam_type, self.current_year):
                            uploaded_files.append(pdf_file)
                    except Exception as e:
                        print(f"Error processing PDF {pdf_file.name}: {e}")
                        continue
            
        except zipfile.BadZipFile as e:
            print(f"Error extracting {zip_path}: {e}")
        except Exception as e:
            print(f"Error processing {zip_path}: {e}")
        finally:
            # Always clean up temp dir and ZIP, regardless of success or failure
            shutil.rmtree(temp_extract_dir, ignore_errors=True)
            if zip_path.exists():
                zip_path.unlink()
                print(f"Removed ZIP: {zip_path.name}")
        
        return uploaded_files
    
    def process_zip_url(self, zip_url: str, exam_type: str) -> bool:
        """Process a single ZIP URL — download, extract, and upload to R2."""
        if zip_url in self.seen_urls:
            return False

        parsed_url = urlparse(zip_url)
        zip_filename = os.path.basename(parsed_url.path)
        print(f"Processing: {zip_filename}")
        
        # Create a temporary download directory
        self.temp_dir.mkdir(exist_ok=True)
        zip_path = self.temp_dir / zip_filename
        
        # Download ZIP file
        if not self.download_file(zip_url, zip_path):
            return False
        
        # Extract ZIP file and organize PDFs by subject
        uploaded_files = self.extract_zip_file(zip_path, self.temp_dir, exam_type)
        
        if uploaded_files:
            self.seen_urls.add(zip_url)
            return True
        
        return False
    
    def run(self):
        """Main scraper execution."""
        print(f"Starting BAC exam scraper for year {self.current_year}")
        print(f"Worker URL: {self.worker_url}")
        
        zips_count = 0
        
        for url in self.urls:
            print(f"\nProcessing URL: {url}")
            
            # Fetch webpage
            html_content = self.fetch_page(url)
            if not html_content:
                continue
            
            # Extract ZIP links
            zip_links = self.extract_links(html_content, url)
            print(f"Found {len(zip_links)} ZIP files")
            
            # Process each ZIP link
            for zip_url in zip_links:
                # Parse URL to get filename for exam type determination
                parsed_url = urlparse(zip_url)
                zip_filename = os.path.basename(parsed_url.path)
                exam_type = self.determine_exam_type(url, zip_filename)
                
                if self.process_zip_url(zip_url, exam_type):
                    zips_count += 1
        
        # Save updated seen URLs
        self.save_seen_urls()
        
        return zips_count


def main():
    """Entry point for the scraper."""
    parser = argparse.ArgumentParser(
        description='Web scraper for Romanian Baccalaureate exam files from subiecte.edu.ro'
    )
    parser.add_argument(
        '--year', '-y',
        type=int,
        default=datetime.now().year,
        help=f'Year to scrape exam files for (default: {datetime.now().year})'
    )
    parser.add_argument(
        '--worker-url', '-w',
        type=str,
        default=os.environ.get('WORKER_URL', 'https://cuza-worker.dynow.workers.dev'),
        help='Worker URL for R2 uploads'
    )
    parser.add_argument(
        '--password', '-p',
        type=str,
        default=os.environ.get('UPLOAD_PASSWORD', ''),
        help='Upload password for the worker API'
    )
    
    args = parser.parse_args()
    
    if not args.password:
        print("Error: Upload password is required. Set UPLOAD_PASSWORD env var or use --password.")
        import sys
        sys.exit(1)
    
    try:
        scraper = BacExamScraper(
            worker_url=args.worker_url,
            upload_password=args.password,
            year=args.year,
        )
        zips_count = scraper.run()
        
        if zips_count > 0:
            print(f"Scraping completed. Downloaded {zips_count} new ZIPs.")
        else:
            print("No new ZIPs found.")
            
    except KeyboardInterrupt:
        print("\nScraping interrupted by user.")
        import sys
        sys.exit(1)
    except Exception as e:
        print(f"Error during scraping: {e}")
        import sys
        sys.exit(1)


if __name__ == "__main__":
    main()
