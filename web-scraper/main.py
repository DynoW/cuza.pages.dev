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
                self.base_dir = current_file.parent.parent
        self.web_scraper_dir = Path(__file__).parent
        self.files_dir = self.base_dir / "files"
        self.seen_urls_file = self.web_scraper_dir / "seen_urls.txt"
        self.temp_dir = self.web_scraper_dir / "temp"
        
        # Use provided year or default to current year
        self.current_year = year if year is not None else datetime.now().year
        
        # URL patterns for the current year
        self.archive_on = True

        self.set_archive = self.current_year if self.archive_on else ""

        self.urls = [
            f"http://subiecte{self.set_archive}.edu.ro/{self.current_year}/bacalaureat/modeledesubiecte/probescrise/",
            f"http://subiecte{self.set_archive}.edu.ro/{self.current_year}/simulare/simulare_bac_XII/",
            f"http://subiecte{self.set_archive}.edu.ro/{self.current_year}/bacalaureat/Subiecte_si_bareme/"
        ]
        
        # Subject mapping for file organization
        self.subject_mapping = {
            'romana': 'romana',
            'matematica': 'mate',
            'istorie': 'istorie',
            'anatomie': 'anatomie',
            'chimie': 'chimie',
            'socio_umane': 'socio',
            'logica': 'logica',
            'psihologie': 'psiho',
            'geografie': 'geogra',
            'fizica': 'fizica',
            'informatica': 'info'
        }
        
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
        # 1. Standard: E_[abcd]_...2025...zip
        # 2. Model: Bac_2025_E_[abcd]_...zip  
        # 3. Various other formats with year
        patterns = [
            rf'href=\"([^\"]*E_[abcd]_[^\"]*{self.current_year}[^\"]*\.zip)\"',  # E_a_2025_...
            rf'href=\"([^\"]*Bac_{self.current_year}_E_[abcd]_[^\"]*\.zip)\"',   # Bac_2025_E_a_...
            rf'href=\"([^\"]*{self.current_year}[^\"]*E_[abcd][^\"]*\.zip)\"',   # Other formats with year and E_x
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
        if 'simulare' in url_lower:
            return 'Simulare'
        elif 'modeledesubiecte' in url_lower or 'model' in filename_lower or 'modele' in filename_lower:
            return 'Model'
        
        # Check filename patterns for model files
        if 'bac_' in filename_lower and ('model' in filename_lower or 'modele' in filename_lower):
            return 'Model'
        
        # For regular bac URL, determine based on filename patterns
        if 'ses_speciala' in filename_lower or 'speciala' in filename_lower:
            return 'Sesiune-olimpici'
        elif 'ses_iunie' in filename_lower or 'iunie' in filename_lower:
            return 'Sesiunea-I'  # June session
        elif 'sesiune_august' in filename_lower or 'august' in filename_lower:
            return 'Sesiunea-II'  # August session
        elif 'model' in filename_lower or 'modele' in filename_lower:
            return 'Model'
        elif 'simulare' in filename_lower:
            return 'Simulare'
        elif 'rezerva' in filename_lower:
            # Reserve sessions are typically part of the main session
            if 'iunie' in filename_lower:
                return 'Sesiunea-I'
            elif 'august' in filename_lower:
                return 'Sesiunea-II'
            else:
                return 'Sesiunea-I'  # Default reserve to Session I
        
        # Try to detect session by number patterns in filename
        # Session numbers: 01 = Sesiunea-I (June), 04 = Sesiunea-II (August), 06 = Sesiune-olimpici, etc.
        import re
        session_match = re.search(r'_(\d{2})_', filename_lower)
        if session_match:
            session_num = session_match.group(1)
            if session_num == '01':
                return 'Sesiunea-I'
            elif session_num in ['04', '09']:  # 04 and 09 seem to be August sessions
                return 'Sesiunea-II'
            elif session_num in ['03', '05', '06']:  # Special sessions
                return 'Sesiune-olimpici'
            elif session_num in ['07', '08']:  # Reserve sessions
                return 'Sesiunea-I'  # Default reserves to Session I
        
        # Default fallback
        return 'Bac'
    
    def parse_filename_info(self, filename: str) -> dict:
        """Parse exam file information from filename."""
        # Remove .zip extension for parsing
        base_name = filename.replace('.zip', '')
        
        # Try different patterns to match various filename formats
        patterns = [
            # E_a_subject_session_year_type.zip
            r'E_([acd])_(\w+)_(\w+)_(\d{4})_(\w+)',
            # E_a_year_session_type.zip
            r'E_([acd])_(\d{4})_(\w+)_?(\w+)?',
            # E_a_year_session.zip
            r'E_([acd])_(\d{4})_(\w+)',
            # E_a_subject_year_type.zip
            r'E_([acd])_(\w+)_(\d{4})_(\w+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, base_name, re.IGNORECASE)
            if match:
                groups = match.groups()
                letter = groups[0]
                
                # Try to extract subject and other info based on pattern
                if len(groups) >= 5:  # E_a_subject_session_year_type
                    subject, session, year, exam_type = groups[1:5]
                elif len(groups) == 4:  # E_a_year_session_type or E_a_subject_year_type
                    if groups[1].isdigit():  # year comes first
                        year, session, exam_type = groups[1:4]
                        subject = self.extract_subject_from_letter(letter)
                    else:  # subject comes first
                        subject, year, exam_type = groups[1:4]
                        session = 'regular'
                elif len(groups) == 3:  # E_a_year_session
                    year, session = groups[1:3]
                    subject = self.extract_subject_from_letter(letter)
                    exam_type = session
                else:
                    continue
                
                # Map subject names to folder names
                subject_lower = subject.lower()
                folder_subject = self.get_folder_subject(subject_lower, letter)
                
                return {
                    'letter': letter,
                    'subject': subject,
                    'folder_subject': folder_subject,
                    'year': year,
                    'exam_type': exam_type,
                    'variant_type': 'var'
                }
        
        return None
    
    def extract_subject_from_letter(self, letter: str) -> str:
        """Extract subject name from exam letter code."""
        letter_to_subject = {
            'a': 'romana',
            'c': 'matematica', 
            'd': 'fizica'  # Could also be informatica, we'll determine from context
        }
        return letter_to_subject.get(letter.lower(), 'unknown')
    
    def get_folder_subject(self, subject: str, letter: str) -> str:
        """Get the correct folder name for the subject."""
        # Handle special cases and mappings
        subject_mappings = {
            'romana': 'romana',
            'matematica': 'mate',
            'fizica': 'fizica', 
            'informatica': 'info',
            'unknown': self.extract_subject_from_letter(letter)
        }
        
        # First try direct mapping
        if subject in subject_mappings:
            mapped_subject = subject_mappings[subject]
            if mapped_subject != subject:
                return mapped_subject
        
        # For letter 'd', check for informatica specifically
        if letter.lower() == 'd':
            if 'informatica' in subject.lower():
                return 'info'
            else:
                return 'fizica'
        
        # Default mapping
        return subject_mappings.get(subject, subject)
    
    def detect_subject_from_zip_content(self, zip_path: Path) -> str:
        """Detect the primary subject from ZIP file contents."""
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # Count different subject types in filenames
                subject_counts = {
                    'informatica': 0,
                    'fizica': 0,
                    'matematica': 0,
                    'romana': 0
                }
                
                for file_info in zip_ref.filelist:
                    filename = file_info.filename.lower()
                    if 'informatica' in filename:
                        subject_counts['informatica'] += 1
                    elif 'fizica' in filename:
                        subject_counts['fizica'] += 1
                    elif 'matematica' in filename:
                        subject_counts['matematica'] += 1
                    elif 'romana' in filename:
                        subject_counts['romana'] += 1
                
                # Return the subject with the highest count
                if subject_counts['informatica'] > 0:
                    return 'info'
                elif subject_counts['fizica'] > 0:
                    return 'fizica'
                elif subject_counts['matematica'] > 0:
                    return 'mate'
                elif subject_counts['romana'] > 0:
                    return 'romana'
        except:
            pass
        
        return None
    
    def create_target_path(self, file_info: dict, exam_type: str) -> Path:
        """Create the target file path based on file information."""
        subject_dir = self.files_dir / file_info['folder_subject'] / 'bac' / file_info['year'] / exam_type
        subject_dir.mkdir(parents=True, exist_ok=True)
        return subject_dir
    
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
    
    def extract_subject_from_pdf_name(self, pdf_filename: str) -> str:
        """Extract subject from PDF filename to determine correct folder."""
        filename_lower = pdf_filename.lower()
        
        # Map keywords in filename to subject folders
        subject_keywords = {
            'romana': 'romana',
            'matematica': 'mate',
            'mate': 'mate',
            'fizica': 'fizica',
            'informatica': 'info',
            'chimie': 'chimie',
            'biologie': 'bio',
            'bio': 'bio',
            'geografie': 'geografie',
            'istorie': 'istorie',
            'filosofie': 'filosofie',
            'logica': 'logica',
            'psihologie': 'psihologie',
            'sociologie': 'sociologie',
            'economie': 'economie',
            'anatomie': 'anatomie',
            'anat': 'anatomie',
            'chimie_anorganica': 'chimie',
            'chimie_organica': 'chimie',
            'bio_veg_anim': 'bio',
            'anat_fiz_gen_ec_um': 'anatomie'
        }
        
        # Check for exact matches first, then partial matches
        for keyword, folder in subject_keywords.items():
            if keyword in filename_lower:
                return folder
                
        # Special handling for compound names
        if 'chimie' in filename_lower:
            return 'chimie'
        if 'bio' in filename_lower:
            return 'bio'
        if 'anat' in filename_lower:
            return 'anatomie'
        
        return None
    
    def organize_pdf_by_subject(self, pdf_path: Path, temp_extract_dir: Path, exam_type: str, year: str) -> bool:
        """Organize a single PDF file into the correct subject folder."""
        filename = pdf_path.name
        
        # Extract subject from filename
        subject_folder = self.extract_subject_from_pdf_name(filename)
        if not subject_folder:
            print(f"Could not determine subject for: {filename}")
            return False
        
        # Create target directory for this subject
        target_dir = self.files_dir / subject_folder / 'bac' / year / exam_type
        target_dir.mkdir(parents=True, exist_ok=True)
        
        # Clean up the filename by removing language suffixes
        clean_filename = filename
        language_suffixes = ['_LRO', '_LMA', '_LGE', '_LSK', '_LSR', '_LUA']
        for suffix in language_suffixes:
            if suffix + '.pdf' in clean_filename:
                clean_filename = clean_filename.replace(suffix + '.pdf', '.pdf')
                break
        
        # Create final file path with cleaned filename
        target_file = target_dir / clean_filename
        
        try:
            # Copy the file to the correct location (instead of move to avoid cross-device issues)
            shutil.copy2(pdf_path, target_file)
            print(f"Organized: {clean_filename} -> {subject_folder}")
            return True
        except OSError as e:
            print(f"Error copying {filename}: {e}")
            return False
    
    def extract_zip_file(self, zip_path: Path, target_dir: Path, exam_type: str) -> list:
        """Extract ZIP file and organize PDFs by subject."""
        extracted_files = []
        
        # Create a temporary extraction directory
        temp_extract_dir = target_dir / f"temp_{zip_path.stem}"
        temp_extract_dir.mkdir(exist_ok=True)
        
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # Get year from zip filename or use current year
                year_match = re.search(r'(\d{4})', zip_path.name)
                year = year_match.group(1) if year_match else str(self.current_year)
                
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
                        if self.organize_pdf_by_subject(pdf_path, temp_extract_dir, exam_type, year):
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
        '--base-dir',
        type=str,
        help='Base directory for the project (auto-detected if not provided)'
    )
    
    args = parser.parse_args()
    
    try:
        scraper = BacExamScraper(base_dir=args.base_dir, year=args.year)
        new_files = scraper.run()
        
        if new_files > 0:
            print(f"Scraping completed. Downloaded {new_files} new files.")
            sys.exit(0)
        else:
            print("No new files found.")
            sys.exit(0)
            
    except KeyboardInterrupt:
        print("\nScraping interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"Error during scraping: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()