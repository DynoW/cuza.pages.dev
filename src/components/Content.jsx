import { Fragment, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useUmami } from '../hooks/useUmami';
// import { useGoogle } from '../hooks/useGoogle';

// Update the glob pattern to look in files instead of public/files
const data = await import.meta.glob(
    "/files/**/*.pdf",
    { eager: true, query: "?url" }
);

// Build category structure from file paths
const buildCategories = () => {
    const categories = {};

    for (const file in data) {
        // Skip files containing the text "ignore"
        if (file.toLowerCase().includes('ignore')) {
            continue;
        }

        const filePath = file.replace("/files/", "");
        const pathParts = filePath.split("/");

        let currentCategory = categories;

        pathParts.forEach((subDirectory, index) => {
            if (!currentCategory[subDirectory]) {
                if (index === pathParts.length - 1) {
                    currentCategory[subDirectory] = pathParts;
                } else {
                    currentCategory[subDirectory] = {};
                }
            }
            currentCategory = currentCategory[subDirectory];
        });
    }

    return categories;
};

const categories = buildCategories();

// Create a mapping of file paths to their imported URLs
const filePathToUrl = {};

// Process all files to get their URLs
const processFileUrls = async () => {
    for (const file in data) {
        // Skip files containing the text "ignore"
        if (file.toLowerCase().includes('ignore')) {
            continue;
        }

        const filePath = file.replace("/files/", "");
        filePathToUrl[filePath] = data[file].default;
    }
};

// Initialize the URL mapping
processFileUrls();

const Content = ({ subject, page, expansionMode = "years" }) => {
    const { trackUmami } = useUmami();
    // const { trackGoogle } = useGoogle();

    // Initialize based on stored preference or default value
    const [currentExpansionMode, setCurrentExpansionMode] = useState(
        typeof localStorage !== 'undefined' ?
            localStorage.getItem('folderExpansionMode') || expansionMode :
            expansionMode
    );

    // Use a ref to track if initial expansion has been set
    const initialExpansionSet = useRef(false);

    // State for expanded folders
    const [expandedFolders, setExpandedFolders] = useState({});

    // Listen for expansion mode changes
    useEffect(() => {
        const handleExpansionModeChange = (event) => {
            const { mode } = event.detail;
            setCurrentExpansionMode(mode);
            updateFolderExpansion(mode);
        };

        window.addEventListener('expansionModeChanged', handleExpansionModeChange);

        return () => {
            window.removeEventListener('expansionModeChanged', handleExpansionModeChange);
        };
    }, []);

    // Initialize folder expansion based on mode when component mounts
    useEffect(() => {
        if (!initialExpansionSet.current) {
            updateFolderExpansion(currentExpansionMode);
            initialExpansionSet.current = true;
        }
    }, [currentExpansionMode]);

    // Function to update folder expansion based on mode
    const updateFolderExpansion = (mode) => {
        const newExpanded = {};

        // Helper function to traverse the category structure
        const processCategory = (category, path = '') => {
            if (typeof category !== 'object' || category === null) return;

            Object.keys(category).forEach(key => {
                const currentPath = path ? `${path}-${key}` : key;
                const isYear = /^20\d{2}$/.test(key);

                if (mode === 'all' || (mode === 'years' && isYear)) {
                    newExpanded[currentPath] = true;
                }

                processCategory(category[key], currentPath);
            });
        };

        // Get content path parts
        const pageParts = page.split('/');
        const mainPage = pageParts[0];

        // Find the appropriate category to process
        let targetCategory;
        if (pageParts.length > 1 && categories[subject] && categories[subject][mainPage]) {
            // For nested paths like 'fizica/altele'
            let current = categories[subject][mainPage];
            const remainingParts = pageParts.slice(1);

            for (const part of remainingParts) {
                if (current && current[part]) {
                    current = current[part];
                } else {
                    current = null;
                    break;
                }
            }
            targetCategory = current;
        } else {
            // For direct paths like 'altele'
            targetCategory = categories[subject]?.[page];
        }

        if (targetCategory) {
            processCategory(targetCategory);
        }

        setExpandedFolders(newExpanded);
    };

    // Helper function to generate a unique key
    const generateKey = useCallback((key, index) => {
        return `${key.replace(/-/g, " ")}-${index}`;
    }, []);

    // Extract repeated logic for class determination
    // Check if this is an altele page (either directly or nested)
    const isAltele = page === 'altele' || page.endsWith('/altele');

    const classNames = useMemo(() => ({
        list: isAltele ? "altele-list" : "content-list",
        link: isAltele ? "altele-link" : "content-link",
        text: isAltele ? "altele-text" : "content-text",
        folder: isAltele ? "altele-folder" : "content-folder",
    }), [isAltele]);

    // Toggle folder expansion with analytics
    const toggleFolder = useCallback((folderPath) => {
        const isCurrentlyExpanded = !!expandedFolders[folderPath];
        const newState = !isCurrentlyExpanded;

        setExpandedFolders(prev => ({
            ...prev,
            [folderPath]: newState
        }));

        // Track folder toggle event
        trackUmami('toggle_folder', {
            folder: folderPath,
        });
        // trackGoogle('toggle_folder', {
        //     folder: folderPath,
        // });
    }, [expandedFolders, subject, page]);

    // In the listDir function, update the file URL generation
    const listDir = useCallback((dict, level = 0, parentPath = '') => {
        if (typeof dict !== 'object' || dict === null || Array.isArray(dict)) {
            return null;
        }

        const entries = Object.entries(dict).reverse();

        return (
            <ul className={`${classNames.list} ${level > 0 ? 'ml-4' : ''}`}>
                {entries.map(([key, value], index) => {
                    // Skip "altele" folders when they're in the main content area (not in altele page)
                    if (key === 'altele' && !isAltele && subject === 'admitere') {
                        return null;
                    }

                    const isFile = typeof value !== 'object' || value === null || Array.isArray(value);
                    const formattedKey = key.replace(/-/g, " ");
                    const itemPath = parentPath ? `${parentPath}-${key}` : key;
                    const isExpanded = !!expandedFolders[itemPath];

                    if (isFile) {
                        const fileName = value[value.length - 1];
                        const filePath = value.join("/");

                        // Skip files containing the text "ignore"
                        if (fileName.toLowerCase().includes('ignore')) {
                            return null;
                        }

                        // Use the processed URL instead of the public path
                        const fileUrl = filePathToUrl[filePath] || `/files/${filePath}`;

                        return (
                            <li key={generateKey(fileName, index)}>
                                <a
                                    className={`${classNames.link} flex items-center break-normal`}
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`Open ${fileName} in new tab`}
                                    onClick={() => {
                                        // Track file download event
                                        trackUmami('download_file', {
                                            filePath,
                                            subject,
                                            page
                                        });
                                        // trackGoogle('download_file', {
                                        //     filePath,
                                        //     subject,
                                        //     page
                                        // });
                                    }}
                                >
                                    {!isAltele && (
                                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                                            <path fill="currentColor" d="M8 10a1 1 0 100-2 1 1 0 000 2zm0 2a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1z" />
                                        </svg>
                                    )}
                                    {fileName.split('_').map((part, i, arr) => (
                                        <Fragment key={`part-${i}`}>
                                            {part}{i < arr.length - 1 && <><wbr />_</>}
                                        </Fragment>
                                    ))}
                                </a>
                            </li>
                        );
                    } else {
                        // Rest of your folder rendering code remains the same
                        const showDivider = index === 0 && level === 1;
                        const isYear = /^20\d{2}$/.test(key);

                        return (
                            <li
                                key={generateKey(key, index)}
                                className="space-y-2"
                                id={isYear ? key : undefined}
                            >
                                {showDivider && <hr className="border-black" />}
                                <div
                                    className={`${classNames.folder} flex items-center cursor-pointer`}
                                    onClick={() => toggleFolder(itemPath)}
                                >
                                    <svg
                                        className={`w-5 h-5 mr-2 transition-transform duration-200 ${isExpanded ? 'transform rotate-90' : ''}`}
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path d="M6 6L14 10L6 14V6Z" />
                                    </svg>
                                    <div className="flex items-center">
                                        <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                        </svg>
                                        <p className={classNames.text}>{formattedKey}</p>
                                    </div>
                                </div>
                                {isExpanded && listDir(value, level + 1, itemPath)}
                            </li>
                        );
                    }
                })}
            </ul>
        );
    }, [classNames, expandedFolders, generateKey, toggleFolder, isAltele, subject, page]);

    // Get content based on path structure
    const getContent = () => {
        // Split the page path if it contains slashes
        const pageParts = page.split('/');

        // If it's a simple path, use it directly
        if (pageParts.length === 1) {
            if (!categories[subject] || !categories[subject][page]) {
                return (
                    <div className="p-4 text-center">
                        <p>No content available for this section.</p>
                    </div>
                );
            }
            return listDir(categories[subject][page]);
        }

        // For nested paths, traverse the structure
        let currentContent = categories[subject];
        for (const part of pageParts) {
            if (!currentContent || !currentContent[part]) {
                return (
                    <div className="p-4 text-center">
                        <p>No content available for this section.</p>
                    </div>
                );
            }
            currentContent = currentContent[part];
        }

        return listDir(currentContent);
    };

    return (
        <div className="content-container">
            {getContent()}
        </div>
    );
};

export default Content;