#!/usr/bin/env python3
"""
Web scraper for Romanian Baccalaureate exam files from subiecte.edu.ro
Downloads and organizes exam PDFs with standardized naming and specialization-specific placement.

Filename format: E_letter_subject_specialization_year_extra_varbar.pdf
Example: E_c_mate_mate-info_2024_simulare_var.pdf
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
from typing import Dict, List, Optional, Tuple

class BacExamScraper:
    def __init__(self, base_dir: str = None, year: int = None):
        """Initialize the scraper with project paths and configuration."""
        # Find project root by looking for a marker file
        if base_dir:
            self.base_dir = Path(base_dir)
        else:
            current_file = Path(__file__)
            for parent in [current_file.parent, *current_file.parents]:
                if (parent / '.git').exists() or (parent / 'package.json').exists():
                    self.base_dir = parent
                    break
            else:
                self.base_dir = current_file.parent.parent
        
        self.web_scraper_dir = Path(__file__).parent
        self.files_dir = self.base_dir / "files"
        self.seen_urls_file = self.web_scraper_dir / "seen_urls.txt"
        self.temp_dir = self.web_scraper_dir / "temp"
        
        # Use provided year or default to current year
        self.current_year = year if year is not None else datetime.now().year
        
        # URL patterns for the current year
        self.urls = [
            f"https://subiecte.edu.ro/{self.current_year}/bacalaureat/modeledesubiecte/probescrise/",
            f"https://subiecte.edu.ro/{self.current_year}/simulare/simulare_bac_XII/",
            f"https://subiecte.edu.ro/{self.current_year}/bacalaureat/Subiecte_si_bareme/"
        ]
        
        # Subject mapping from file names to standardized names
        self.subject_mapping = {
            'romana': 'romana',
            'matematica': 'mate',
            'mate': 'mate',
            'fizica': 'fizica',
            'informatica': 'info',
            'chimie': 'chimie',
            'biologie': 'bio',
            'bio': 'bio',
            'geografie': 'geo',
            'istorie': 'istorie',
            'filosofie': 'filo',
            'logica': 'logica',
            'psihologie': 'psiho',
            'sociologie': 'socio',
            'economie': 'eco',
            'anatomie': 'anat',
            'anat': 'anat'
        }
        
        # Probe letter to subject mapping
        self.probe_subject_mapping = {
            'a': 'romana',
            'c': 'mate', 
            'd': None  # Will be determined from content (fizica or info)
        }
        
        # Subject to specialization mapping (single specialization per subject)
        self.subject_specialization = {
            'romana': 'toate',  # All specializations have Romanian
            'mate': 'mate-info',  # Default math to mate-info
            'fizica': 'stiinte-ale-naturii',  # Physics primarily in sciences
            'info': 'mate-info',
            'chimie': 'stiinte-ale-naturii',
            'bio': 'stiinte-ale-naturii',
            'biologie': 'stiinte-ale-naturii',
            'geo': 'socio-umane',
            'geografie': 'socio-umane',
            'istorie': 'socio-umane',
            'filo': 'socio-umane',
            'filosofie': 'socio-umane',
            'logica': 'socio-umane',
            'psiho': 'socio-umane',
            'psihologie': 'socio-umane',
            'socio': 'socio-umane',
            'sociologie': 'socio-umane',
            'eco': 'socio-umane',
            'economie': 'socio-umane',
            'anat': 'stiinte-ale-naturii',
            'anatomie': 'stiinte-ale-naturii'
        }
        
        # Special handling for subjects that appear in multiple specializations
        self.subject_context_rules = {
            'mate': {
                # Context clues to determine if math should go to socio-umane vs mate-info
                'socio_indicators': ['socio', 'umane', 'uman', 'profil_uman'],
                'info_indicators': ['info', 'informatica', 'real', 'mate_info']
            }
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
        """Fetch webpage content with proper headers."""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                             '(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            print(f"Error fetching {url}: {e}")
            return ""
    
    def extract_zip_links(self, html_content: str, base_url: str) -> List[str]:
        """Extract ZIP file links matching the exam pattern."""
        # Enhanced pattern to match various ZIP file formats
        patterns = [
            rf'href=["\']([^"\']*E_[acd]_[^"\']*{self.current_year}[^"\']*\.zip)["\']',
            rf'href=["\']([^"\']*{self.current_year}[^"\']*E_[acd][^"\']*\.zip)["\']',
            rf'href=["\']([^"\']*[Bb]ac[^"\']*{self.current_year}[^"\']*\.zip)["\']'
        ]
        
        zip_links = set()
        for pattern in patterns:
            matches = re.findall(pattern, html_content, re.IGNORECASE)
            for match in matches:
                if match.startswith('http'):
                    zip_links.add(match)
                else:
                    zip_links.add(urljoin(base_url, match))
        
        return list(zip_links)
    
    def parse_filename_components(self, filename: str) -> Optional[Dict[str, str]]:
        """Parse filename to extract exam components with improved accuracy."""
        # Remove .pdf extension and normalize
        base_name = filename.replace('.pdf', '').replace('.zip', '')
        
        # Enhanced patterns to match various filename formats
        patterns = [
            # E_letter_subject_year_session_type
            r'E_([acd])_(\w+)_(\d{4})_([^_]+)_(\w+)',
            # E_letter_year_session_subject_type  
            r'E_([acd])_(\d{4})_([^_]+)_(\w+)_(\w+)',
            # E_letter_subject_session_year_type
            r'E_([acd])_(\w+)_([^_]+)_(\d{4})_(\w+)',
            # E_letter_year_session_type (subject from letter)
            r'E_([acd])_(\d{4})_([^_]+)_(\w+)',
            # E_letter_subject_year_type (no session)
            r'E_([acd])_(\w+)_(\d{4})_(\w+)',
            # Simple E_letter_year format
            r'E_([acd])_(\d{4})'
        ]
        
        for i, pattern in enumerate(patterns):
            match = re.search(pattern, base_name, re.IGNORECASE)
            if match:
                groups = match.groups()
                probe_letter = groups[0].lower()
                
                # Extract components based on pattern
                if i == 0:  # E_letter_subject_year_session_type
                    subject_raw, year, session, var_type = groups[1:5]
                elif i == 1:  # E_letter_year_session_subject_type
                    year, session, subject_raw, var_type = groups[1:5]
                elif i == 2:  # E_letter_subject_session_year_type
                    subject_raw, session, year, var_type = groups[1:5]
                elif i == 3:  # E_letter_year_session_type
                    year, session, var_type = groups[1:4]
                    subject_raw = self.probe_subject_mapping.get(probe_letter, 'unknown')
                elif i == 4:  # E_letter_subject_year_type
                    subject_raw, year, var_type = groups[1:4]
                    session = 'regular'
                else:  # E_letter_year
                    year = groups[1]
                    subject_raw = self.probe_subject_mapping.get(probe_letter, 'unknown')
                    session = 'regular'
                    var_type = 'var'
                
                # Normalize subject
                subject = self.normalize_subject(subject_raw)
                
                # Determine specialization based on subject and context
                specialization = self.determine_specialization(subject, base_name)
                
                # Normalize exam type and session
                exam_type = self.normalize_exam_type(session if 'session' in locals() else 'regular')
                
                # Determine if this is variant or answer key
                var_bar = self.determine_var_bar(var_type if 'var_type' in locals() else filename)
                
                return {
                    'probe_letter': probe_letter,
                    'subject': subject,
                    'specialization': specialization,
                    'year': year,
                    'exam_type': exam_type,
                    'var_bar': var_bar,
                    'original_filename': filename
                }
        
        return None
    
    def normalize_subject(self, subject_raw: str) -> str:
        """Normalize subject name to standardized format."""
        subject_lower = subject_raw.lower()
        
        # Direct mapping first
        if subject_lower in self.subject_mapping:
            return self.subject_mapping[subject_lower]
        
        # Partial matching for compound subjects
        for key, value in self.subject_mapping.items():
            if key in subject_lower:
                return value
        
        # Special cases
        if 'matematica' in subject_lower or 'mat' in subject_lower:
            return 'mate'
        elif 'romanian' in subject_lower or 'rom' in subject_lower:
            return 'romana'
        elif 'physic' in subject_lower or 'fiz' in subject_lower:
            return 'fizica'
        elif 'computer' in subject_lower or 'inf' in subject_lower:
            return 'info'
        
        return subject_lower
    
    def determine_specialization(self, subject: str, filename_context: str) -> str:
        """Determine the correct specialization for a subject based on context."""
        # Default specialization for most subjects
        if subject in self.subject_specialization:
            base_specialization = self.subject_specialization[subject]
            
            # Special handling for math which can appear in multiple specializations
            if subject == 'mate' and subject in self.subject_context_rules:
                rules = self.subject_context_rules[subject]
                filename_lower = filename_context.lower()
                
                # Check for socio-umane indicators
                if any(indicator in filename_lower for indicator in rules['socio_indicators']):
                    return 'socio-umane'
                # Check for mate-info indicators  
                elif any(indicator in filename_lower for indicator in rules['info_indicators']):
                    return 'mate-info'
                # For sciences track, math should go to stiinte-ale-naturii if context suggests it
                elif 'nat' in filename_lower or 'stiint' in filename_lower:
                    return 'stiinte-ale-naturii'
            
            return base_specialization
        
        # Fallback to mate-info for unknown subjects
        return 'mate-info'
    
    def normalize_exam_type(self, exam_type_raw: str) -> str:
        """Normalize exam type to standardized format."""
        exam_type_lower = exam_type_raw.lower()
        
        # Mapping for exam types
        type_mapping = {
            'model': 'model',
            'simulare': 'simulare', 
            'sim': 'simulare',
            's1': 'sesiunea-i',
            's2': 'sesiunea-ii', 
            'ss': 'sesiunea-speciala',
            'iunie': 'sesiunea-i',
            'august': 'sesiunea-ii',
            'special': 'sesiunea-speciala',
            'olimpici': 'sesiunea-speciala',
            'rezerva': 'sesiunea-i',
            'regular': 'sesiunea-i'
        }
        
        for key, value in type_mapping.items():
            if key in exam_type_lower:
                return value
        
        # Default fallback
        return 'sesiunea-i'
    
    def determine_var_bar(self, type_indicator: str) -> str:
        """Determine if file is variant (var) or answer key (bar)."""
        indicator_lower = type_indicator.lower()
        
        if any(term in indicator_lower for term in ['bar', 'barem', 'answer', 'raspuns']):
            return 'bar'
        else:
            return 'var'
    
    def create_standardized_filename(self, components: Dict[str, str]) -> str:
        """Create standardized filename from components."""
        # Format: E_letter_subject_specialization_year_extra_varbar.pdf
        parts = [
            'E',
            components['probe_letter'],
            components['subject'],
            components['specialization'],
            components['year']
        ]
        
        # Add exam type if it's not the default session
        if components['exam_type'] != 'sesiunea-i':
            parts.append(components['exam_type'])
        
        # Add var/bar indicator
        parts.append(components['var_bar'])
        
        return '_'.join(parts) + '.pdf'
    
    def should_skip_file(self, filename: str) -> bool:
        """Check if file should be skipped (minority languages, etc.)."""
        skip_markers = ['_LMA', '_LGE', '_LSK', '_LSR', '_LUA', '_LHU', '_LIT', '_LTR']
        skip_keywords = ['minoritatea', 'pentru_minoritatea', 'minority']
        
        filename_upper = filename.upper()
        filename_lower = filename.lower()
        
        # Check for language markers
        if any(marker in filename_upper for marker in skip_markers):
            return True
        
        # Check for minority keywords
        if any(keyword in filename_lower for keyword in skip_keywords):
            return True
        
        return False
    
    def detect_subject_from_zip_content(self, zip_path: Path) -> Optional[str]:
        """Detect primary subject from ZIP file contents."""
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                subject_counts = {}
                
                for file_info in zip_ref.filelist:
                    if not file_info.filename.lower().endswith('.pdf'):
                        continue
                    
                    # Parse filename to get subject
                    components = self.parse_filename_components(file_info.filename)
                    if components:
                        subject = components['subject']
                        subject_counts[subject] = subject_counts.get(subject, 0) + 1
                
                # Return most common subject
                if subject_counts:
                    return max(subject_counts, key=subject_counts.get)
        
        except Exception as e:
            print(f"Error analyzing ZIP content: {e}")
        
        return None
    
    def download_file(self, url: str, target_path: Path) -> bool:
        """Download file from URL to target path."""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(url, headers=headers, timeout=60)
            response.raise_for_status()
            
            target_path.parent.mkdir(parents=True, exist_ok=True)
            with open(target_path, 'wb') as f:
                f.write(response.content)
            
            print(f"Downloaded: {target_path.name}")
            return True
        except requests.RequestException as e:
            print(f"Error downloading {url}: {e}")
            return False
    
    def process_pdf_file(self, pdf_path: Path, temp_dir: Path) -> bool:
        """Process a single PDF file and place it in correct location."""
        filename = pdf_path.name
        
        # Skip minority language files
        if self.should_skip_file(filename):
            print(f"Skipping minority language file: {filename}")
            return False
        
        # Parse filename components
        components = self.parse_filename_components(filename)
        if not components:
            print(f"Could not parse filename: {filename}")
            return False
        
        # Create standardized filename
        standardized_name = self.create_standardized_filename(components)
        
        # Determine target directory
        target_dir = (self.files_dir / 
                     components['subject'] / 
                     components['specialization'] / 
                     components['year'] / 
                     components['exam_type'].title())
        
        target_dir.mkdir(parents=True, exist_ok=True)
        target_file = target_dir / standardized_name
        
        try:
            # Copy file with standardized name
            shutil.copy2(pdf_path, target_file)
            print(f"Processed: {filename} -> {standardized_name}")
            print(f"  Location: {components['subject']}/{components['specialization']}")
            return True
        except OSError as e:
            print(f"Error copying {filename}: {e}")
            return False
    
    def extract_and_process_zip(self, zip_path: Path) -> int:
        """Extract ZIP file and process all PDF files."""
        processed_count = 0
        temp_extract_dir = self.temp_dir / f"extract_{zip_path.stem}"
        
        try:
            temp_extract_dir.mkdir(parents=True, exist_ok=True)
            
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # Extract all PDF files
                pdf_files = []
                for zip_info in zip_ref.filelist:
                    if (zip_info.filename.lower().endswith('.pdf') and 
                        zip_info.file_size > 0 and
                        not self.should_skip_file(zip_info.filename)):
                        
                        try:
                            zip_ref.extract(zip_info, temp_extract_dir)
                            pdf_path = temp_extract_dir / zip_info.filename
                            if pdf_path.exists() and pdf_path.stat().st_size > 0:
                                pdf_files.append(pdf_path)
                        except Exception as e:
                            print(f"Error extracting {zip_info.filename}: {e}")
                
                print(f"Found {len(pdf_files)} valid PDF files in {zip_path.name}")
                
                # Process each PDF file
                for pdf_path in pdf_files:
                    if self.process_pdf_file(pdf_path, temp_extract_dir):
                        processed_count += 1
        
        except zipfile.BadZipFile as e:
            print(f"Invalid ZIP file {zip_path}: {e}")
        except Exception as e:
            print(f"Error processing ZIP {zip_path}: {e}")
        finally:
            # Clean up
            if temp_extract_dir.exists():
                shutil.rmtree(temp_extract_dir, ignore_errors=True)
            if zip_path.exists():
                zip_path.unlink()
        
        return processed_count
    
    def process_zip_url(self, zip_url: str) -> int:
        """Process a single ZIP URL - download and extract."""
        if zip_url in self.seen_urls:
            return 0  # Already processed
        
        # Parse URL to get filename
        parsed_url = urlparse(zip_url)
        zip_filename = os.path.basename(parsed_url.path)
        
        print(f"\nProcessing: {zip_filename}")
        
        # Create temporary download path
        self.temp_dir.mkdir(exist_ok=True)
        zip_path = self.temp_dir / zip_filename
        
        # Download ZIP file
        if not self.download_file(zip_url, zip_path):
            return 0
        
        # Process ZIP file
        processed_count = self.extract_and_process_zip(zip_path)
        
        if processed_count > 0:
            self.seen_urls.add(zip_url)
            print(f"Successfully processed {processed_count} files from {zip_filename}")
        
        return processed_count
    
    def run(self) -> int:
        """Main scraper execution."""
        print(f"Starting BAC exam scraper for year {self.current_year}")
        print(f"Base directory: {self.base_dir}")
        print(f"Files will be organized with standardized naming and single specialization placement")
        
        total_processed = 0
        
        for url in self.urls:
            print(f"\n{'='*60}")
            print(f"Processing URL: {url}")
            
            # Fetch webpage
            html_content = self.fetch_page(url)
            if not html_content:
                print("Failed to fetch page content")
                continue
            
            # Extract ZIP links  
            zip_links = self.extract_zip_links(html_content, url)
            print(f"Found {len(zip_links)} potential ZIP files")
            
            # Process each ZIP link
            for zip_url in zip_links:
                processed = self.process_zip_url(zip_url)
                total_processed += processed
        
        # Save updated seen URLs
        self.save_seen_urls()
        
        print(f"\n{'='*60}")
        print(f"Scraping completed. Processed {total_processed} new files.")
        
        return total_processed


def main():
    """Entry point for the scraper."""
    parser = argparse.ArgumentParser(
        description='Web scraper for Romanian Baccalaureate exam files with standardized naming'
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
        processed_files = scraper.run()
        
        if processed_files > 0:
            print(f"\nScraping successful! Processed {processed_files} files.")
            sys.exit(0)
        else:
            print("\nNo new files found to process.")
            sys.exit(0)
            
    except KeyboardInterrupt:
        print("\nScraping interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\nError during scraping: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()