#!/usr/bin/env python3
"""
Web scraper for Romanian Baccalaureate exam files from subiecte.edu.ro
Downloads and organizes exam PDFs by subject and year.
"""

import argparse
import os
import re
import shutil
import sys
import zipfile
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup

class BacExamScraper:
    def __init__(self, base_dir: str = None, year: int = None):
        # Find project root by looking for a marker file (like .git, package.json, etc.)
        if base_dir:
            self.base_dir = Path(base_dir)
        else:
            current_file = Path(__file__)
            # Look for project root markers
            for parent in [current_file.parent, *current_file.parents]:
                if (parent / '.git').exists() or (parent / 'package.json').exists():
                    self.base_dir = parent
                    break
            else:
                # Fallback to original logic
                print("Base dir not found")
                self.base_dir = current_file.parent.parent
        
        self.files_dir = self.base_dir / "files"

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
            rf'href=\"([^\"]*E_[acd]_[^\"]*{self.current_year}[^\"]*\.zip)\"',  # E_a_2025_...
            rf'href=\"([^\"]*Bac_{self.current_year}_E_[acd]_[^\"]*\.zip)\"',   # Bac_2025_E_a_...
            rf'href=\"([^\"]*{self.current_year}[^\"]*E_[acd][^\"]*\.zip)\"',   # Other formats with year and E_a
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
        
        # Check URL first for broad categories
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
        if  '_iun' in filename_lower or '_iul' in filename_lower:
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
    #! START ORGANIZE
    def extract_subject_from_pdf_name(self, pdf_filename: str) -> str:
        """Extract subject from PDF filename to determine correct folder."""
        filename_lower = pdf_filename.lower()
        
        # Map keywords in filename to subject folders
        subject_keywords = {
            # e_a_
            'romana': 'romana', # fara "pentru": real/uman | E_a_romana_real_tehn_2025_var_model.pdf
            # e_c_
            'matematica': 'mate', # LRO: mate-info/pedagogic/st-nat/thenologic | E_c_matematica_M_mate-info_2025_var_model_LRO.pdf
            'istorie': 'istorie', # LRO | E_c_istorie_2025_var_simulare_LRO.pdf
            # e_d_
            'anat_fiz_gen_ec_um': 'anat', # LRO | E_d_anat_fiz_gen_ec_um_2025_var_model_LRO.pdf
            'bio_veg_anim': 'bio', # LRO | E_d_bio_veg_anim_2025_var_model_LRO.pdf
            'chimie': 'chimie', # LRO: anorganica/organica | E_d_chimie_anorganica_2025_var_model_LRO.pdf
            'economie': 'economie', # LRO | E_d_economie_2025_var_model_LRO.pdf
            'filosofie': 'filosofie', # LRO | E_d_filosofie_2025_var_model_LRO.pdf
            'fizica': 'fizica', # LRO: thenologic/teoretic | E_d_fizica_teoretic_vocational_2025_var_model_LRO.pdf
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
        """Extract subcategory from PDF filename to determine correct folder."""
        filename_lower = pdf_filename.lower()
        
        # Define subcategory keywords
        subcategory_keywords = {
            'real_tehn': 'real',
            'uman_ped': 'uman',
            'm_mate-info': 'mate-info',
            'm_pedagogic': 'pedagogic',
            'm_st-nat': 'st-nat',
            'm_tehnologic': 'thenologic',
            'anorganica': 'anorganica',
            'organica': 'organica',
            'tehnologic': 'thenologic',
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
        
        return 'bac'  # Default subcategory if none found
    
    def organize_pdf_by_subject(self, pdf_path: Path, exam_type: str, year: str) -> bool:
        """Organize a single PDF file into the correct subject folder."""
        filename = pdf_path.name
        
        # Clean up the filename by removing language suffixes
        clean_filename = filename
        language_suffixes = ['_LRO', '_LMA', '_LGE', '_LSK', '_LSR', '_LUA']
        for suffix in language_suffixes:
            if suffix + '.pdf' in clean_filename:
                clean_filename = clean_filename.replace(suffix + '.pdf', '.pdf')
                break

        # Extract subject from filename
        subject = self.extract_subject_from_pdf_name(filename)
        if not subject:
            print(f"Warning: Could not determine subject for: {filename}")
            return False

        # Extract subcategory from filename
        subcategory = self.extract_subcategory_from_pdf_name(filename)

        target_dir = self.files_dir / subject / 'pages' / subcategory / year / exam_type

        if (subcategory == 'mate-info-bareme' or subcategory == 'st-nat-bareme'):
            self.copy_bar_to_both_c_and_pascal(pdf_path, subcategory, target_dir, clean_filename)
        else:
            # Create target directory for this subject
            target_dir.mkdir(parents=True, exist_ok=True)
            
            # Create final file path with cleaned filename
            target_file = target_dir / clean_filename
            
            try:
                # Copy the file to the correct location (instead of move to avoid cross-device issues)
                shutil.copy2(pdf_path, target_file)
                print(f"Organized: {clean_filename} -> {subject}")
                return True
            except OSError as e:
                print(f"Error copying {filename}: {e}")
                return False

    def copy_bar_to_both_c_and_pascal(self, pdf_path: Path, subcategory: str, target_dir: Path, clean_filename: str):
        """Copy bar files to both C and Pascal subcategories."""
        new_subcategory = str(subcategory).replace('bareme', '')

        c_target_dir = str(target_dir).replace(subcategory, new_subcategory + 'C')
        pascal_target_dir = str(target_dir).replace(subcategory, new_subcategory + 'Pascal')

        c_target_dir = Path(c_target_dir)
        pascal_target_dir = Path(pascal_target_dir)
        
        c_target_dir.mkdir(parents=True, exist_ok=True)
        pascal_target_dir.mkdir(parents=True, exist_ok=True)
        
        c_target_file = c_target_dir / clean_filename # .replace('bar', 'bar_C')
        pascal_target_file = pascal_target_dir / clean_filename # .replace('bar', 'bar_Pascal')
        
        try:
            shutil.copy2(pdf_path, c_target_file)
            shutil.copy2(pdf_path, pascal_target_file)
            print(f"Organized info barem file: {clean_filename} -> {c_target_file.parent.name} and {pascal_target_file.parent.name}")
            return True
        except OSError as e:
            print(f"Error copying bar file {clean_filename}: {e}")
            return False

    #! STOP
    def extract_zip_file(self, zip_path: Path, target_temp_dir: Path, exam_type: str) -> list:
        """Extract ZIP file and organize PDFs by subject."""
        extracted_files = []
        
        # Create a temporary extraction directory
        temp_extract_dir = target_temp_dir / f"temp_{zip_path.stem}"
        temp_extract_dir.mkdir(exist_ok=True)
        
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # Process each file in the ZIP
                pdf_files = []
                for zip_info in zip_ref.filelist:
                    if zip_info.filename.lower().endswith('.pdf') and zip_info.file_size > 0:
                        try:
                            # Extract the PDF file directly
                            zip_ref.extract(zip_info, temp_extract_dir)
                            pdf_path = temp_extract_dir / zip_info.filename
                            
                            # Ensure the PDF file actually exists and has content
                            if pdf_path.exists() and pdf_path.is_file() and pdf_path.stat().st_size > 0:
                                pdf_files.append(pdf_path)
                            else:
                                print(f"Warning: Extracted file is empty or invalid: {zip_info.filename}")
                        except Exception as e:
                            print(f"Error extracting {zip_info.filename}: {e}")
                            continue
                
                print(f"Found {len(pdf_files)} PDF files in {zip_path.name}")
                
                # Filter for LRO files only and exclude minority files
                lro_files = [f for f in pdf_files if 
                           ('_LRO.pdf' in f.name or (not any(lang in f.name for lang in ['_LMA', '_LGE', '_LSK', '_LSR', '_LUA']) and f.name.endswith('.pdf'))) 
                           and 'pentru_minoritatea' not in f.name.lower() 
                           and 'minoritatea' not in f.name.lower()]
                print(f"Processing {len(lro_files)} LRO files (Romanian language, excluding minority files)")
                
                # Process each LRO PDF file
                for pdf_path in lro_files:
                    try:
                        if self.organize_pdf_by_subject(pdf_path, exam_type, self.current_year):
                            extracted_files.append(pdf_path)
                    except Exception as e:
                        print(f"Error processing PDF {pdf_path.name}: {e}")
                        continue
            
            # Clean up temporary directory
            shutil.rmtree(temp_extract_dir, ignore_errors=True)
            
            # Remove the ZIP file after extraction
            zip_path.unlink()
            print(f"Removed ZIP: {zip_path.name}")
            
        except zipfile.BadZipFile as e:
            print(f"Error extracting {zip_path}: {e}")
            # Clean up on error
            shutil.rmtree(temp_extract_dir, ignore_errors=True)
        except Exception as e:
            print(f"Error processing {zip_path}: {e}")
            # Clean up on error
            shutil.rmtree(temp_extract_dir, ignore_errors=True)
        
        return extracted_files
    
    def process_zip_url(self, zip_url: str, exam_type: str) -> bool:
        """Process a single ZIP URL - download and extract."""
        if zip_url in self.seen_urls:
            return False # Already processed
        
        # Parse URL to get filename
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
        extracted_files = self.extract_zip_file(zip_path, self.temp_dir, exam_type)
        
        if extracted_files:
            self.seen_urls.add(zip_url)
            return True
        
        return False
    
    def run(self):
        """Main scraper execution."""
        print(f"Starting BAC exam scraper for year {self.current_year}")
        print(f"Base directory: {self.base_dir}")
        
        new_files_count = 0
        
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
                    new_files_count += 1
        
        # Save updated seen URLs
        self.save_seen_urls()
        
        return new_files_count


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
        '--base-dir', '-d',
        type=str,
        help='Base directory for the project (auto-detected if not provided)'
    )
    
    args = parser.parse_args()
    
    try:
        scraper = BacExamScraper(base_dir=args.base_dir, year=args.year)
        new_urls = scraper.run()
        
        if new_urls > 0:
            print(f"Scraping completed. Downloaded {new_urls} new urls.")
            sys.exit(0)
        else:
            print("No new urls found.")
            sys.exit(0)
            
    except KeyboardInterrupt:
        print("\nScraping interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"Error during scraping: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
