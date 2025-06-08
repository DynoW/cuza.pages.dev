import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useEffect, useState, useCallback } from "react";

const LOCAL_STORAGE_KEY = "excalidraw-romana";

const ExcalidrawWrapper = () => {
    const [excalidrawData, setExcalidrawData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [excalidrawAPI, setExcalidrawAPI] = useState(null);
    const [hasUserChanges, setHasUserChanges] = useState(false);
    const [originalSchemaHash, setOriginalSchemaHash] = useState(null);
    const [isSmallScreen, setIsSmallScreen] = useState(false);

    // Check screen size on mount and when window is resized
    useEffect(() => {
        const checkScreenSize = () => {
            setIsSmallScreen(window.innerWidth < 1000);
        };

        // Initial check
        checkScreenSize();

        // Add event listener for window resize
        window.addEventListener('resize', checkScreenSize);

        // Cleanup
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    // Simple hash function to compare schemas
    const hashElements = (elements) => {
        if (!elements || !elements.length) return '';
        return elements.map(el => el.id).sort().join('|');
    };

    // Fetch the initial schema from the server
    const fetchSchema = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/assets/excalidraw/romana.excalidraw');
            if (!response.ok) {
                throw new Error(`Failed to fetch schema: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            // Validate the data has elements before setting it
            if (data && data.elements && data.elements.length > 0) {
                // Only save the elements to localStorage
                const elementsOnly = { elements: data.elements };
                setExcalidrawData(elementsOnly);
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(elementsOnly));

                // Store the original schema hash for comparison
                const hash = hashElements(data.elements);
                setOriginalSchemaHash(hash);
                localStorage.setItem(`${LOCAL_STORAGE_KEY}-hash`, hash);

                setHasUserChanges(false);
            } else {
                console.error('Fetched schema has no elements');
            }
        } catch (error) {
            console.error('Error loading Excalidraw file:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);
    // Load data on initial mount - either from localStorage or from server
    useEffect(() => {
        const loadExcalidrawFile = async () => {
            try {
                setIsLoading(true);
                // Try to load from localStorage first
                const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
                const savedHash = localStorage.getItem(`${LOCAL_STORAGE_KEY}-hash`);

                setOriginalSchemaHash(savedHash);

                if (savedData) {
                    try {
                        const parsedData = JSON.parse(savedData);
                        // Validate that we have elements before using local data
                        if (parsedData && parsedData.elements && parsedData.elements.length > 0) {
                            setExcalidrawData(parsedData);
                            // We don't automatically set hasUserChanges to true when loading
                            // This will only be set to true when the user makes actual changes
                            setHasUserChanges(false);
                        } else {
                            console.warn('Saved data has no elements, fetching from server instead');
                            await fetchSchema();
                        }
                    } catch (parseError) {
                        console.error('Error parsing saved data:', parseError);
                        await fetchSchema();
                    }
                } else {
                    // Fetch from server if no local data exists
                    await fetchSchema();
                }
            } catch (error) {
                console.error('Error loading Excalidraw data:', error);
                // If error occurs with local data, try fetching from server
                await fetchSchema();
            } finally {
                setIsLoading(false);
            }
        };

        loadExcalidrawFile();
        return () => { };
    }, [fetchSchema]);
    // Save changes when user modifies the diagram
    useEffect(() => {
        if (excalidrawAPI) {
            // Set the hand tool as active and locked
            excalidrawAPI.setActiveTool({
                type: "hand",
                locked: true
            });            // Add onChange handler to detect and save user changes
            const onChange = () => {
                try {
                    if (excalidrawAPI) {
                        const elements = excalidrawAPI.getSceneElements();

                        // Only save if we have elements to prevent blank page
                        if (elements && elements.length > 0) {
                            // Save only the elements to localStorage
                            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ elements }));

                            // Compare with original schema to determine if there are changes
                            const currentHash = hashElements(elements);
                            const hasChanges = currentHash !== originalSchemaHash;
                            setHasUserChanges(hasChanges);
                        }
                    }
                } catch (error) {
                    console.error('Error saving Excalidraw data:', error);
                }
            };

            // Register the onChange handler
            excalidrawAPI.onChange(onChange);
        }
    }, [excalidrawAPI]);

    // Handle updating the Romanian schema (ignoring local changes)
    const handleUpdateSchema = async () => {
        if (window.confirm("Acest lucru va actualiza schema română și va înlocui modificările făcute de tine. Ești sigur?")) {
            await fetchSchema();
        }
    }; if (isLoading) {
        return (
            <div className="excalidraw-loading" style={{
                height: '100dvh', /* dynamic viewport height */
                maxHeight: '-webkit-fill-available', /* for iOS Safari */
                width: '100%',
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}>
                Loading scene...
            </div>
        );
    } return (
        <div className="excalidraw-container" style={{
            height: '100dvh', /* dynamic viewport height */
            maxHeight: '-webkit-fill-available', /* for iOS Safari */
            width: '100%',
            overflow: 'hidden'
        }}>
            <Excalidraw
                excalidrawAPI={(api) => setExcalidrawAPI(api)}
                initialData={{
                    elements: excalidrawData?.elements || [],
                    appState: {
                        theme: "dark",
                        gridSize: null,
                        currentItemType: "hand",
                        ...(excalidrawData?.appState || {})
                    }, scrollToContent: true,
                    files: {}
                }}
                onChange={(elements, appState, files) => {
                    // This is a backup to ensure UI stays responsive
                    // even if the main onChange handler fails
                    if (elements && elements.length > 0) {
                        const currentHash = hashElements(elements);
                        const hasChanges = currentHash !== originalSchemaHash;
                        setHasUserChanges(hasChanges);
                    }
                }}
                renderTopRightUI={() => {
                    return (
                        <button
                            style={{
                                background: "#70b1ec",
                                border: "none",
                                color: "#fff",
                                width: "max-content",
                                fontWeight: "bold",
                                borderRadius: "0.5rem",
                                paddingLeft: "8px",
                                paddingRight: "8px",
                                // Use isSmallScreen state for responsive positioning
                                paddingTop: "4px",
                                paddingBottom: "4px",
                                position: isSmallScreen ? "fixed" : "relative",
                                bottom: isSmallScreen ? "70px" : "auto",
                                right: isSmallScreen ? "15px" : "auto",
                                zIndex: isSmallScreen ? "100" : "auto",
                            }}
                            onClick={handleUpdateSchema}
                        >
                            {hasUserChanges ? "Resetează schema română" : "Aceasta este schema initială"}
                        </button>
                    );
                }}
            />
        </div>
    );
};

export default ExcalidrawWrapper;
