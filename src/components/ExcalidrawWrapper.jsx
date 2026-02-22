import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useEffect, useState, useCallback, useRef } from "react";

const LOCAL_STORAGE_KEY = "excalidraw-romana";
const EXCALIDRAW_FILE = "/assets/excalidraw/romana.excalidraw";

// Pure hash: includes version so edits to existing elements are detected
const hashElements = (elements) => {
    if (!elements || !elements.length) return '';
    return elements.map(el => `${el.id}:${el.version ?? 0}`).sort().join('|');
};

const ExcalidrawWrapper = () => {
    const [excalidrawData, setExcalidrawData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [excalidrawAPI, setExcalidrawAPI] = useState(null);
    const [hasUserChanges, setHasUserChanges] = useState(false);
    const [isSmallScreen, setIsSmallScreen] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState(false);

    // Use a ref so the onChange callback always sees the latest hash
    const originalSchemaHashRef = useRef(null);

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

    // Check if a schema update is available from the server
    const checkForSchemaUpdates = useCallback(async () => {
        try {
            const response = await fetch(EXCALIDRAW_FILE);
            if (!response.ok) {
                console.error(`Failed to check for updates: ${response.status} ${response.statusText}`);
                return;
            }

            const data = await response.json();
            if (data && data.elements && data.elements.length > 0) {
                const serverHash = hashElements(data.elements);
                const localHash = localStorage.getItem(`${LOCAL_STORAGE_KEY}-hash`);

                // If server hash is different from local hash, an update is available
                setUpdateAvailable(serverHash !== localHash);
            }
        } catch (error) {
            console.error('Error checking for schema updates:', error);
        }
    }, []);    // Fetch the initial schema from the server
    const fetchSchema = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await fetch(EXCALIDRAW_FILE);
            if (!response.ok) {
                throw new Error(`Failed to fetch schema: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            // Validate the data has elements before setting it
            if (data && data.elements && data.elements.length > 0) {
                // Save both elements and files to localStorage
                const dataToSave = { 
                    elements: data.elements,
                    files: data.files || {}
                };
                setExcalidrawData(dataToSave);
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));

                // Store the original schema hash for comparison
                const hash = hashElements(data.elements);
                originalSchemaHashRef.current = hash;
                localStorage.setItem(`${LOCAL_STORAGE_KEY}-hash`, hash);

                // Reset flags
                setHasUserChanges(false);
                setUpdateAvailable(false);
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

                originalSchemaHashRef.current = savedHash;

                if (savedData) {
                    try {
                        const parsedData = JSON.parse(savedData);
                        // Validate that we have elements before using local data
                        if (parsedData && parsedData.elements && parsedData.elements.length > 0) {
                            setExcalidrawData(parsedData);
                            // We don't automatically set hasUserChanges to true when loading
                            // This will only be set to true when the user makes actual changes
                            setHasUserChanges(false);

                            // Check for updates after loading local data
                            await checkForSchemaUpdates();
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

        // Set up periodic update check (every 10 minutes)
        const updateCheckInterval = setInterval(() => {
            checkForSchemaUpdates();
        }, 10 * 60 * 1000);

        return () => {
            clearInterval(updateCheckInterval);
        };
    }, [fetchSchema, checkForSchemaUpdates]);
    // Set hand tool and register onChange handler
    useEffect(() => {
        if (!excalidrawAPI) return;

        excalidrawAPI.setActiveTool({
            type: "hand",
            locked: true
        });

        // Single onChange handler: saves to localStorage and tracks changes
        const unsubscribe = excalidrawAPI.onChange(() => {
            try {
                const elements = excalidrawAPI.getSceneElements();
                const files = excalidrawAPI.getFiles();

                if (elements && elements.length > 0) {
                    const dataToSave = { elements, files };
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));

                    const currentHash = hashElements(elements);
                    setHasUserChanges(currentHash !== originalSchemaHashRef.current);
                }
            } catch (error) {
                console.error('Error saving Excalidraw data:', error);
            }
        });

        return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
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
                        activeTool: {
                            type: "hand",
                            locked: true
                        },
                        currentItemType: "hand",
                        ...(excalidrawData?.appState || {})
                    }, scrollToContent: true,
                    files: excalidrawData?.files || {}
                }}
                renderTopRightUI={() => {
                    // Determine button style and text based on state
                    const buttonText = updateAvailable
                        ? "Actualizare schema disponibilă"
                        : (hasUserChanges ? "Resetează schema română" : "Aceasta este schema initială");

                    const buttonBackground = updateAvailable
                        ? "#4CAF50" // Green for update available
                        : "#70b1ec"; // Default blue

                    return (
                        <button
                            style={{
                                background: buttonBackground,
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
                            {buttonText}
                        </button>
                    );
                }}
            />
        </div>
    );
};

export default ExcalidrawWrapper;
