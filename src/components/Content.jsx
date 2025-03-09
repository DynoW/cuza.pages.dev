import { useState, useCallback, useMemo } from 'react';

// Update the glob pattern to look in src instead of public
const data = await import.meta.glob(
    "/src/files/**/*.pdf"
);

// Build category structure from file paths
const buildCategories = () => {
    const categories = {};

    for (const file in data) {
        data[file](); // Ensure file is loaded
        // Update the path replacement to match the new location
        const filePath = file.replace("/src/files/", "");
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

const Content = ({ subject, page }) => {
    // Start with all folders expanded by default
    const [expandedFolders, setExpandedFolders] = useState({});

    // Helper function to generate a unique key
    const generateKey = useCallback((key, index) => {
        return `${key.replace(/-/g, " ")}-${index}`;
    }, []);

    // Extract repeated logic for class determination
    const isAltele = page.includes('altele');
    const classNames = useMemo(() => ({
        list: isAltele ? "altele-list" : "content-list",
        link: isAltele ? "altele-link" : "content-link",
        text: isAltele ? "altele-text" : "content-text",
        folder: isAltele ? "altele-folder" : "content-folder",
    }), [isAltele, page]);

    // Toggle folder expansion
    const toggleFolder = useCallback((folderPath) => {
        setExpandedFolders(prev => ({
            ...prev,
            [folderPath]: !prev[folderPath]
        }));
    }, []);

    const listDir = useCallback((dict, level = 0, parentPath = '') => {
        if (typeof dict !== 'object' || dict === null || Array.isArray(dict)) {
            return null;
        }

        const entries = Object.entries(dict).reverse();
        
        return (
            <ul className={`${classNames.list} ${level > 0 ? 'ml-4' : ''}`}>
                {entries.map(([key, value], index) => {
                    const isFile = typeof value !== 'object' || value === null || Array.isArray(value);
                    const formattedKey = key.replace(/-/g, " ");
                    const itemPath = parentPath ? `${parentPath}-${key}` : key;
                    const isExpanded = !!expandedFolders[itemPath];
                    
                    if (isFile) {
                        const fileName = value[value.length - 1];
                        const filePath = value.join("/");
                        
                        return (
                            <li key={generateKey(fileName, index)}>
                                <a 
                                    className={`${classNames.link} flex items-center`}
                                    href={`/src/files/${filePath}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`Open ${fileName} in new tab`}
                                >
                                    {!isAltele && (
                                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                                            <path fill="currentColor" d="M8 10a1 1 0 100-2 1 1 0 000 2zm0 2a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1z" />
                                        </svg>
                                    )}
                                    {fileName}
                                </a>
                            </li>
                        );
                    } else {
                        const showDivider = index === 0 && level === 1;
                        
                        return (
                            <li key={generateKey(key, index)} className="space-y-2">
                                {showDivider && <hr className="border-black" />}
                                <div 
                                    className={`${classNames.folder} flex items-center cursor-pointer`}
                                    onClick={() => toggleFolder(itemPath)}
                                >
                                    {/* Improved folder toggle icon */}
                                    <svg 
                                        className={`w-5 h-5 mr-2 transition-transform duration-200 ${isExpanded ? 'transform rotate-90' : ''}`} 
                                        fill="currentColor" 
                                        viewBox="0 0 20 20"
                                    >
                                        <path d="M6 6L14 10L6 14V6Z" />
                                    </svg>
                                    <div className="flex items-center">
                                        {/* Folder icon */}
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
    }, [classNames, expandedFolders, generateKey, toggleFolder]);

    // Handle missing content gracefully
    if (!categories[subject] || !categories[subject][page]) {
        return <div className="p-4 text-center">
            <p>No content available for this section.</p>
        </div>;
    }
    
    return (
        <div className="content-container">
            {listDir(categories[subject][page])}
        </div>
    );
};

export default Content;