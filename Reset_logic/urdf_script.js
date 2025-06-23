import { MediaPipePoseController } from './MediaPipePoseController.js';


class ProfessionalURDFViewer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.robot = null; // The root THREE.Group for the entire robot
        this.joints = {}; // Stores parsed joint data
        this.links = {};  // Stores THREE.Group for each link
        this.jointControls = {};
        this.axesHelpers = [];
        this.meshFiles = new Map(); // Stores File objects, keyed by base filename
        this.loadedGeometries = new Map(); // Stores loaded THREE.BufferGeometry, keyed by original mesh path
        this.gridHelper = null;
        this.autoRotateEnabled = false;
        this.stats = { links: 0, joints: 0, triangles: 0 };
        this.poseController = null; // Changed from handController to poseController as per provided code

        this.init();
        this.setupEventListeners();
        this.animate();
    }
    
    init() {
        // Scene setup with professional lighting
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a14);
        this.scene.fog = new THREE.Fog(0x0a0a14, 10, 50);

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(4, 4, 4);
        this.camera.lookAt(0, 0, 0);

        // Renderer setup with enhanced quality
        const urdfCanvas = document.getElementById('urdfCanvas'); // Get the canvas element
        this.renderer = new THREE.WebGLRenderer({
            canvas: urdfCanvas, // Associate with the specific canvas
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        // Set initial size based on the viewport div, not window
        const viewportDiv = document.getElementById('viewport');
        if (viewportDiv) {
            this.renderer.setSize(viewportDiv.clientWidth, viewportDiv.clientHeight);
        } else {
            // Fallback if viewportDiv is not found immediately
            this.renderer.setSize(window.innerWidth - 350, window.innerHeight);
        }
        
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        // Note: No need to append renderer.domElement if using `canvas: urdfCanvas` in WebGLRenderer constructor
        // unless you're dynamically creating the canvas. Your HTML already has it.

        // Professional lighting setup
        this.setupLighting();

        // Grid
        this.gridHelper = new THREE.GridHelper(10, 20, 0x444466, 0x222233);
        this.gridHelper.material.transparent = true;
        this.gridHelper.material.opacity = 0.3;
        this.scene.add(this.gridHelper);

        // Mouse controls
        this.setupMouseControls();

        // Keyboard controls
        this.setupKeyboardControls();

        // MediaPipe Pose Controller Initialization
        const webcamVideoElement = document.getElementById('webcam');
       if (webcamVideoElement) {
        this.poseController = new MediaPipePoseController(this, webcamVideoElement);
       }          
        else {
            console.error("Webcam video element not found in the DOM.");
        }
    }


    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404060, 0.3);
        this.scene.add(ambientLight);
        
        // Main directional light
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
        mainLight.position.set(10, 15, 5);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 50;
        mainLight.shadow.camera.left = -10;
        mainLight.shadow.camera.right = 10;
        mainLight.shadow.camera.top = 10;
        mainLight.shadow.camera.bottom = -10;
        mainLight.shadow.bias = -0.0005;
        this.scene.add(mainLight);
        
        // Fill light
        const fillLight = new THREE.DirectionalLight(0x6366f1, 0.4);
        fillLight.position.set(-5, 5, -5);
        this.scene.add(fillLight);
        
        // Rim light
        const rimLight = new THREE.DirectionalLight(0xa855f7, 0.3);
        rimLight.position.set(0, -5, 10);
        this.scene.add(rimLight);
        
        // Point lights for dramatic effect
        const pointLight1 = new THREE.PointLight(0x6366f1, 0.5, 20);
        pointLight1.position.set(5, 3, 5);
        this.scene.add(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0xa855f7, 0.3, 15);
        pointLight2.position.set(-3, 2, -3);
        this.scene.add(pointLight2);
    }
    
    setupMouseControls() {
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        // const element = this.renderer.domElement; // Use the canvas directly for controls
        const element = document.getElementById('urdfCanvas'); // Target the canvas specifically
        
        element.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
            element.style.cursor = 'grabbing';
        });
        
        element.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaMove = {
                    x: e.clientX - previousMousePosition.x,
                    y: e.clientY - previousMousePosition.y
                };
                
                const spherical = new THREE.Spherical();
                spherical.setFromVector3(this.camera.position);
                
                spherical.theta -= deltaMove.x * 0.01;
                spherical.phi += deltaMove.y * 0.01;
                spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
                
                this.camera.position.setFromSpherical(spherical);
                this.camera.lookAt(0, 0, 0);
                
                previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });
        
        element.addEventListener('mouseup', () => {
            isDragging = false;
            element.style.cursor = 'grab';
        });
        
        element.addEventListener('mouseleave', () => {
            isDragging = false;
            element.style.cursor = 'default';
        });
        
        element.addEventListener('wheel', (e) => {
            e.preventDefault();
            const scale = e.deltaY > 0 ? 1.1 : 0.9;
            this.camera.position.multiplyScalar(scale);
            const distance = this.camera.position.length();
            if (distance > 30) this.camera.position.normalize().multiplyScalar(30);
            if (distance < 1) this.camera.position.normalize().multiplyScalar(1);
        });
        
        element.style.cursor = 'grab';
    }
    
    resetCamera() {
        this.camera.position.set(4, 4, 4);
        this.camera.lookAt(0, 0, 0);
    }

    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            switch(e.key.toLowerCase()) {
                case 'r':
                    this.resetCamera();
                    this.updateStatus("Camera view reset.", 'success'); // Added status update
                    break;
                case 'g':
                    const showGridCheckbox = document.getElementById('showGrid');
                    if (showGridCheckbox) {
                        showGridCheckbox.checked = !showGridCheckbox.checked;
                        this.toggleGrid(showGridCheckbox.checked);
                    }
                    break;
                case 'w':
                    const wireframeCheckbox = document.getElementById('wireframe');
                    if (wireframeCheckbox) {
                        wireframeCheckbox.checked = !wireframeCheckbox.checked;
                        this.toggleWireframe(wireframeCheckbox.checked);
                    }
                    break;
            }
        });
    }
    
    setupEventListeners() {
        const urdfInput = document.getElementById('urdfInput');
        const meshInput = document.getElementById('meshInput');
        const loadButton = document.getElementById('loadButton');
        const urdfWrapper = document.getElementById('urdfWrapper');
        const meshWrapper = document.getElementById('meshWrapper');
        const showAxesCheckbox = document.getElementById('showAxes');
        const wireframeCheckbox = document.getElementById('wireframe');
        const showGridCheckbox = document.getElementById('showGrid');
        const autoRotateCheckbox = document.getElementById('autoRotate');
        // const webcamVideoElement = document.getElementById('webcam'); // Already initialized in init()
        const resetPoseButton = document.getElementById('resetPoseButton'); // Get the new reset button

        // File Input Change Listeners
        urdfInput.addEventListener('change', () => this.handleFileInput(urdfInput, urdfWrapper, 'urdf'));
        meshInput.addEventListener('change', (e) => {
            this.processMeshFiles(e.target.files);
            this.handleFileInput(meshInput, meshWrapper, 'mesh'); // Update UI text
        });

        // Drag and Drop Listeners for URDF
        urdfWrapper.addEventListener('dragover', (e) => this.handleDragOver(e, urdfWrapper));
        urdfWrapper.addEventListener('dragleave', (e) => this.handleDragLeave(e, urdfWrapper));
        urdfWrapper.addEventListener('drop', (e) => this.handleDrop(e, urdfInput, urdfWrapper, 'urdf'));

        // Drag and Drop Listeners for Mesh
        meshWrapper.addEventListener('dragover', (e) => this.handleDragOver(e, meshWrapper));
        meshWrapper.addEventListener('dragleave', (e) => this.handleDragLeave(e, meshWrapper));
        meshWrapper.addEventListener('drop', (e) => this.handleDrop(e, meshInput, meshWrapper, 'mesh'));

        // Load Button Click
        loadButton.addEventListener('click', () => {
            if (urdfInput.files.length > 0) {
                this.loadRobot(urdfInput.files[0]); // Pass the URDF file
            } else {
                this.updateStatus("Please select a URDF file first.", 'error');
            }
        });

        // Checkbox Event Listeners
        showAxesCheckbox.addEventListener('change', () => this.toggleAxes(showAxesCheckbox.checked));
        wireframeCheckbox.addEventListener('change', () => this.toggleWireframe(wireframeCheckbox.checked));
        showGridCheckbox.addEventListener('change', () => this.toggleGrid(showGridCheckbox.checked));
        autoRotateCheckbox.addEventListener('change', () => {
            this.autoRotateEnabled = autoRotateCheckbox.checked;
        });

        // NEW: Reset Pose Button Event Listener
        if (resetPoseButton) { // Ensure button exists before adding listener
            resetPoseButton.addEventListener('click', () => {
                if (this.poseController) { // Use this.poseController consistent with init()
                    this.poseController.setRobotToDefaultPose();
                    this.updateStatus("Robot pose reset to default.", 'success');
                } else {
                    this.updateStatus("MediaPipe controller not initialized. Load a robot first.", 'error');
                }
            });
        }


        // Window Resize Listener
        window.addEventListener('resize', () => this.onWindowResize());
    }

    handleFileInput(inputElement, wrapperElement, type) {
        if (inputElement.files.length > 0) {
            wrapperElement.classList.add('has-files');
            let fileName = inputElement.files[0].name;
            if (type === 'mesh') {
                fileName = `${inputElement.files.length} files selected`;
                // Process mesh files immediately on selection to make them available
                // this.processMeshFiles(inputElement.files); // Moved to change listener for meshInput
            } else {
                // Clear previous meshes data when a new URDF is selected
                this.meshFiles.clear(); 
            }
            wrapperElement.querySelector('.file-input-text').innerHTML = `<strong>${fileName}</strong> selected`;
            document.getElementById('loadButton').disabled = (type === 'urdf' && inputElement.files.length === 0);
        } else {
            wrapperElement.classList.remove('has-files');
            wrapperElement.querySelector('.file-input-text').innerHTML = `<strong>Click to select</strong> or drag ${type} file here`;
            document.getElementById('loadButton').disabled = true;
        }
    }

    handleDragOver(e, wrapperElement) {
        e.preventDefault();
        e.stopPropagation();
        wrapperElement.classList.add('drag-over');
    }

    handleDragLeave(e, wrapperElement) {
        e.preventDefault();
        e.stopPropagation();
        wrapperElement.classList.remove('drag-over');
    }

    handleDrop(e, inputElement, wrapperElement, type) {
        e.preventDefault();
        e.stopPropagation();
        wrapperElement.classList.remove('drag-over');

        inputElement.files = e.dataTransfer.files; // Assign dropped files to input
        this.handleFileInput(inputElement, wrapperElement, type);
        if (type === 'mesh') {
            this.processMeshFiles(e.dataTransfer.files); // Process dropped mesh files
        }
    }

    processMeshFiles(files) {
        this.meshFiles.clear(); // Clear previous mesh files
        for (let file of files) {
            // Store files by their base filename for easier lookup from URDF paths
            const baseName = file.name.split('/').pop(); // "mesh.stl"
            this.meshFiles.set(baseName, file); 
            // Also store without extension if URDF uses that
            const nameWithoutExt = baseName.substring(0, baseName.lastIndexOf('.')) || baseName;
            this.meshFiles.set(nameWithoutExt, file);
        }
        this.updateStatus(`Loaded ${files.length} potential mesh files for lookup.`, 'success');
    }

    async loadRobot(urdfFile) { // Accept urdfFile as argument
        if (!urdfFile) {
            this.updateStatus('Please select a URDF file.', 'error');
            return;
        }
    
        this.updateStatus('Loading robot...', 'loading');
        document.getElementById('loadButtonText').innerHTML =
            '<div class="loading-spinner"></div>Loading...';
    
        // Clear previous robot if any
        if (this.robot) {
            this.scene.remove(this.robot);
            this.robot.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(mat => mat.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
        }
        this.robot = new THREE.Group();
        this.robot.name = "Robot_Root";
        this.scene.add(this.robot);
    
        this.joints = {};
        this.links = {};
        this.jointControls = {};
        this.axesHelpers.forEach(helper => {
            if(helper.parent) helper.parent.remove(helper); // Ensure parent exists before removing
        }); 
        this.axesHelpers = [];
        this.loadedGeometries.clear(); // Clear cached geometries
    
        try {
            const urdfContent = await this.readFile(urdfFile);
            await this.parseURDF(urdfContent);
    
            // Apply Universal Rotation to the Entire Robot (as previously agreed)
            this.robot.rotation.x = -Math.PI / 2; // Example: Rotate -90 degrees around X. Adjust as needed.
            
            this.updateStatus('Robot loaded successfully!', 'success');
            document.getElementById('loadButtonText').textContent = 'Load Robot';
    
            // Show joint controls if there are any
            if (Object.keys(this.joints).length > 0) {
                document.getElementById('jointSection').style.display = 'block';
                this.createJointControls(); // Re-create joint controls for new robot
            } else {
                document.getElementById('jointSection').style.display = 'none';
            }
    
            this.fitCameraToObject();
            this.updateStats(); // Update stats display after loading

            // Immediately set robot to default pose when loaded
            if (this.poseController) {
                this.poseController.setRobotToDefaultPose();
            }
    
        } catch (error) {
            console.error('Error loading robot:', error);
            this.updateStatus('Error loading robot: ' + error.message, 'error');
            document.getElementById('loadButtonText').textContent = 'Load Robot';
            this.clearRobot(); // Clean up if loading fails
        }
    }

    
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
    
    async parseURDF(urdfContent) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(urdfContent, "text/xml");
        
        const rootElement = xmlDoc.getElementsByTagName('robot')[0];
        if (!rootElement) {
            throw new Error("Invalid URDF: No 'robot' tag found.");
        }
    
        // Parse materials (if any)
        const materials = {};
        xmlDoc.querySelectorAll('material').forEach(materialElem => {
            const name = materialElem.getAttribute('name');
            const colorElem = materialElem.querySelector('color');
            if (name && colorElem) {
                const rgba = colorElem.getAttribute('rgba').split(' ').map(Number);
                materials[name] = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(rgba[0], rgba[1], rgba[2]),
                    transparent: rgba[3] < 1,
                    opacity: rgba[3]
                });
            }
        });

        // Parse links first
        const linkElements = xmlDoc.getElementsByTagName('link');
        for (let linkElem of linkElements) {
            const name = linkElem.getAttribute('name');
            const linkGroup = new THREE.Group();
            linkGroup.name = name;
            this.links[name] = linkGroup;

            // Parse visual elements within the link
            linkElem.querySelectorAll('visual').forEach(visualElem => {
                this.parseVisual(linkGroup, visualElem, materials);
            });
        }
        
        // Parse joints second to build hierarchy
        const jointElements = xmlDoc.getElementsByTagName('joint');
        for (let jointElem of jointElements) {
            const jointData = this.parseJoint(jointElem);
            this.joints[jointData.name] = jointData;
        }
    
        // Build the Three.js scene graph hierarchy by connecting links via joints
        let rootLinkName = null;
        const childLinkNames = new Set(Object.values(this.joints).map(j => j.child));
        // Find the link that is not a child of any other link
        for (const linkName in this.links) {
            if (!childLinkNames.has(linkName)) {
                rootLinkName = linkName;
                break;
            }
        }
    
        if (rootLinkName && this.links[rootLinkName]) {
            this.robot.add(this.links[rootLinkName]);
        } else if (Object.keys(this.links).length > 0) {
            console.warn("Could not determine a clear root link. Adding links without parents directly to robot group.");
            // If no clear root, add links that don't have a parent specified as a joint child
            Object.values(this.links).forEach(link => {
                let isChildOfJoint = false;
                for(const j of Object.values(this.joints)) {
                    if (j.child === link.name) {
                        isChildOfJoint = true;
                        break;
                    }
                }
                if (!isChildOfJoint) {
                    this.robot.add(link);
                }
            });
        }
    
        // Connect child links to parent links via joints
        for (const jointName in this.joints) {
            const joint = this.joints[jointName];
            const parentLinkGroup = this.links[joint.parent];
            const childLinkGroup = this.links[joint.child];
    
            if (parentLinkGroup && childLinkGroup) {
                // Remove childLinkGroup from its current parent if already added (e.g., as root link)
                if (childLinkGroup.parent) {
                    childLinkGroup.parent.remove(childLinkGroup);
                }
                parentLinkGroup.add(childLinkGroup);
               
                // Apply joint origin transform to the child link group
                this.applyOrigin(childLinkGroup, { xyz: joint.origin.xyz, rpy: joint.origin.rpy });
    
                // Store initial relative position/rotation for prismatic/revolute joints
                joint.initialPosition = childLinkGroup.position.clone();
                joint.initialRotation = childLinkGroup.quaternion.clone();
                this.joints[joint.name].childObject = childLinkGroup; // Store reference to the THREE.Group for direct updates
                
                // Add axis helper to the child link's coordinate frame (if enabled)
                if (document.getElementById('showAxes').checked) {
                    const axisHelper = new THREE.AxesHelper(0.1); // Size of axes
                    // Position axes at the joint's origin
                    axisHelper.position.copy(childLinkGroup.position);
                    axisHelper.quaternion.copy(childLinkGroup.quaternion);
                    parentLinkGroup.add(axisHelper); // Add to parent so it moves with the parent link
                    this.axesHelpers.push(axisHelper);
                }
            } else {
                console.warn(`Missing parent '${joint.parent}' or child '${joint.child}' link for joint: ${jointName}`);
            }
        }
    }

    parseVisual(linkGroup, visualElem, materials) {
        const geometryElem = visualElem.querySelector('geometry');
        const originElem = visualElem.querySelector('origin');
        const materialElem = visualElem.querySelector('material');

        let mesh;
        let meshMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 }); // Default material

        if (materialElem) {
            const materialName = materialElem.getAttribute('name');
            if (materials[materialName]) {
                meshMaterial = materials[materialName];
            } else {
                // If material not found in URDF, try parsing inline color
                const colorElem = materialElem.querySelector('color');
                if (colorElem) {
                    const rgba = colorElem.getAttribute('rgba').split(' ').map(Number);
                    meshMaterial = new THREE.MeshStandardMaterial({
                        color: new THREE.Color(rgba[0], rgba[1], rgba[2]),
                        transparent: rgba[3] < 1,
                        opacity: rgba[3]
                    });
                }
            }
        }

        if (geometryElem) {
            const meshElem = geometryElem.querySelector('mesh');
            const boxElem = geometryElem.querySelector('box');
            const cylinderElem = geometryElem.querySelector('cylinder');
            const sphereElem = geometryElem.querySelector('sphere');

            if (meshElem) {
                const filename = meshElem.getAttribute('filename');
                const scaleAttr = meshElem.getAttribute('scale');
                const scale = scaleAttr ? new THREE.Vector3(...scaleAttr.split(' ').map(Number)) : new THREE.Vector3(1, 1, 1);
                
                this.loadMeshGeometry(filename, scale, meshMaterial).then(loadedMesh => {
                    if (loadedMesh) {
                        mesh = loadedMesh;
                        linkGroup.add(mesh);
                        if (originElem) {
                            this.applyOrigin(mesh, this.parseOrigin(originElem));
                        }
                    } else {
                        // Fallback to box if mesh loading fails
                        console.warn(`Failed to load mesh: ${filename}. Using fallback box.`);
                        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), meshMaterial);
                        if (originElem) {
                            this.applyOrigin(mesh, this.parseOrigin(originElem));
                        }
                        linkGroup.add(mesh);
                    }
                });
            } else if (boxElem) {
                const size = boxElem.getAttribute('size').split(' ').map(Number);
                mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), meshMaterial);
            } else if (cylinderElem) {
                const radius = parseFloat(cylinderElem.getAttribute('radius'));
                const length = parseFloat(cylinderElem.getAttribute('length'));
                mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 32), meshMaterial);
                mesh.rotation.x = Math.PI / 2; // URDF cylinders are Z-up, Three.js are Y-up
            } else if (sphereElem) {
                const radius = parseFloat(sphereElem.getAttribute('radius'));
                mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 32), meshMaterial);
            }
        }

        if (mesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            // Only add if not already added by async loadMeshGeometry
            if (!mesh.parent) { 
                linkGroup.add(mesh);
            }
            if (originElem && !meshElem) { // Apply origin for primitive shapes directly
                this.applyOrigin(mesh, this.parseOrigin(originElem));
            }
        }
    }

    async loadMeshGeometry(filename, scale, material) {
        let geometry;
        const fullPath = filename; // Use filename as is for caching key
        const meshBaseName = this.getBasename(filename); // Just the file name
        
        if (this.loadedGeometries.has(fullPath)) {
            geometry = this.loadedGeometries.get(fullPath);
            const cachedMesh = new THREE.Mesh(geometry, material); // Use a new mesh instance with the same geometry
            cachedMesh.scale.copy(scale);
            return cachedMesh;
        }

        let file = this.meshFiles.get(meshBaseName);
        if (!file) {
            // Try matching without extension if that's how URDF referenced it
            const nameWithoutExt = meshBaseName.substring(0, meshBaseName.lastIndexOf('.')) || meshBaseName;
            file = this.meshFiles.get(nameWithoutExt);
        }

        if (!file) {
            this.updateStatus(`Mesh file not found in uploads: ${filename}. Using fallback box.`, 'error');
            return null; // Return null if file not found, so createVisualMesh can use fallback
        }

        const url = URL.createObjectURL(file);
        const fileExtension = this.getFileExtension(filename);

        try {
            switch (fileExtension) {
                case 'stl':
                    geometry = await new Promise((resolve, reject) => {
                        const loader = new THREE.STLLoader();
                        loader.load(url, resolve, undefined, reject);
                    });
                    break;
                case 'obj':
                    const obj = await new Promise((resolve, reject) => {
                        const loader = new THREE.OBJLoader();
                        loader.load(url, resolve, undefined, reject);
                    });
                    // OBJLoader typically returns a Group containing meshes
                    if (obj.children.length > 0 && obj.children[0].isMesh) {
                        geometry = obj.children[0].geometry;
                    } else {
                        throw new Error("OBJ file did not contain a valid mesh geometry.");
                    }
                    break;
                case 'dae':
                    const collada = await new Promise((resolve, reject) => {
                        const loader = new THREE.ColladaLoader();
                        loader.load(url, resolve, undefined, reject);
                    });
                    // ColladaLoader scene often has deeply nested meshes
                    const meshes = [];
                    collada.scene.traverse((child) => {
                        if (child.isMesh) {
                            meshes.push(child.geometry);
                        }
                    });
                    if (meshes.length > 0) {
                        geometry = meshes[0]; // Take the first geometry found
                    } else {
                        throw new Error("DAE file contained no meshes.");
                    }
                    break;
                case 'ply':
                    // If you intend to support .ply, you'd need to add PLYLoader:
                    // import { PLYLoader } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/loaders/PLYLoader.js';
                    geometry = await new Promise((resolve, reject) => {
                        const loader = new THREE.PLYLoader();
                        loader.load(url, resolve, undefined, reject);
                    });
                    break;
                default:
                    throw new Error(`Unsupported mesh file type: ${fileExtension}`);
            }

            if (!geometry) {
                throw new Error("Geometry not loaded or unsupported format.");
            }
            
            // Ensure geometry has normals for proper lighting
            if (!geometry.attributes.normal) {
                geometry.computeVertexNormals();
            }

            // Dispose URL after loading
            URL.revokeObjectURL(url);

            // Store geometry in cache
            this.loadedGeometries.set(fullPath, geometry);
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.scale.copy(scale);
            return mesh;

        } catch (error) {
            console.error(`Error loading mesh ${filename}:`, error);
            URL.revokeObjectURL(url); // Clean up URL even on error
            return null; // Indicate failure to load mesh
        }
    }

    getBasename(path) {
        return path.split('/').pop().split('\\').pop(); // Handles both / and \ in paths
    }

    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    parseOrigin(originElem) {
        const xyz = originElem.getAttribute('xyz') ? originElem.getAttribute('xyz').split(' ').map(Number) : [0, 0, 0];
        const rpy = originElem.getAttribute('rpy') ? originElem.getAttribute('rpy').split(' ').map(Number) : [0, 0, 0];
        return { xyz: new THREE.Vector3(xyz[0], xyz[1], xyz[2]), rpy: new THREE.Euler(rpy[0], rpy[1], rpy[2], 'ZYX') };
    }

    applyOrigin(object, originData) {
        // originData can be a parsed object {xyz: Vector3, rpy: Euler}
        // or a DOM element (from visual/collision)
        let pos = new THREE.Vector3();
        let rot = new THREE.Euler(0, 0, 0, 'ZYX'); // Default to ZYX order

        if (originData instanceof Element) {
            if (originData.hasAttribute('xyz')) {
                const xyz = originData.getAttribute('xyz').split(' ').map(Number);
                pos.set(xyz[0], xyz[1], xyz[2]);
            }
            if (originData.hasAttribute('rpy')) {
                const rpy = originData.getAttribute('rpy').split(' ').map(Number);
                rot.set(rpy[0], rpy[1], rpy[2], 'ZYX');
            }
        } else if (originData && originData.xyz instanceof THREE.Vector3 && originData.rpy instanceof THREE.Euler) {
            pos.copy(originData.xyz);
            rot.copy(originData.rpy);
        } else {
            console.warn("Invalid originData format:", originData);
            return;
        }
        
        object.position.copy(pos);
        object.quaternion.setFromEuler(rot);

        // Store initial transform for objects that will be manipulated (e.g., child links in joints)
        object.initialPosition = object.position.clone();
        object.initialRotation = object.quaternion.clone();
    }

    parseJoint(jointElem) {
        const name = jointElem.getAttribute('name');
        const type = jointElem.getAttribute('type');
        const parent = jointElem.querySelector('parent')?.getAttribute('link');
        const child = jointElem.querySelector('child')?.getAttribute('link');
        
        if (!parent || !child) {
            console.warn(`Joint ${name} is missing parent or child link. Skipping.`);
            return null; // Return null if invalid joint
        }
        
        const joint = {
            name: name,
            type: type,
            parent: parent,
            child: child,
            currentValue: 0,
            origin: { xyz: [0, 0, 0], rpy: [0, 0, 0] }, // Default origin
            axis: [1, 0, 0], // Default axis
            limit: { lower: -Infinity, upper: Infinity, effort: Infinity, velocity: Infinity } // Default limits
        };
        
        // Parse origin
        const originElement = jointElem.querySelector('origin');
        if (originElement) {
            if (originElement.hasAttribute('xyz')) {
                joint.origin.xyz = originElement.getAttribute('xyz').split(' ').map(Number);
            }
            if (originElement.hasAttribute('rpy')) {
                joint.origin.rpy = originElement.getAttribute('rpy').split(' ').map(Number);
            }
        }
        
        // Parse axis
        const axisElement = jointElem.querySelector('axis');
        if (axisElement && axisElement.hasAttribute('xyz')) {
            joint.axis = axisElement.getAttribute('xyz').split(' ').map(Number);
        }
        
        // Parse limits
        const limitElement = jointElem.querySelector('limit');
        if (limitElement) {
            joint.limit.lower = parseFloat(limitElement.getAttribute('lower')) || 0;
            joint.limit.upper = parseFloat(limitElement.getAttribute('upper')) || 0;
            joint.limit.effort = parseFloat(limitElement.getAttribute('effort')) || Infinity;
            joint.limit.velocity = parseFloat(limitElement.getAttribute('velocity')) || Infinity;

            // Adjust for continuous joints if limits are not strictly defined in URDF
            if (type === 'continuous' && !limitElement.hasAttribute('lower') && !limitElement.hasAttribute('upper')) {
                joint.limit.lower = -Math.PI * 2; // Arbitrarily large range for continuous
                joint.limit.upper = Math.PI * 2;
            }
        } else {
            // Provide sensible defaults for non-limited joints if limits are absent
            if (type === 'revolute' || type === 'continuous') {
                joint.limit.lower = -Math.PI; // Full circle range
                joint.limit.upper = Math.PI;
            } else if (type === 'prismatic') {
                joint.limit.lower = -0.5; 
                joint.limit.upper = 0.5;
            }
        }
        
        this.joints[name] = joint;
        return joint; // Return the parsed joint data
    }


    updateJoint(jointName, angle) {
        const joint = this.joints[jointName];
        if (!joint || !joint.childObject) {
            // console.warn(`Joint '${jointName}' or its child object not found.`);
            return;
        }

        const childLink = joint.childObject;
        const origin = joint.origin;
        const axis = new THREE.Vector3(...joint.axis); // Ensure axis is a THREE.Vector3
        const limit = joint.limit;

        // Ensure angle is within URDF limits (already handled by smoothJoint, but explicitly clamp here too)
        const clampedAngle = Math.max(limit.lower, Math.min(limit.upper, angle));

        // Reset child link to its initial position/orientation relative to its parent's origin.
        // This is crucial to apply the new rotation/translation from a consistent base.
        // Use the stored initialPosition and initialRotation from applyOrigin for robustness
        childLink.position.copy(joint.initialPosition);
        childLink.quaternion.copy(joint.initialRotation);

        if (joint.type === 'revolute' || joint.type === 'continuous') {
            // Create a quaternion for the new rotation around the joint's axis
            const jointRotationQuaternion = new THREE.Quaternion().setFromAxisAngle(axis.normalize(), clampedAngle);
            // Apply this new rotation on top of the initial orientation
            childLink.quaternion.premultiply(jointRotationQuaternion);

        } else if (joint.type === 'prismatic') {
            // Prismatic joint translates along its axis
            const translationVector = axis.normalize().multiplyScalar(clampedAngle);
            childLink.position.add(translationVector);
        }
        
        joint.currentValue = clampedAngle; // Update current value
        // Update UI slider if it exists (for manual control UI)
        if (this.jointControls[jointName]) {
            // Display in degrees for revolute, meters for prismatic
            const displayValue = joint.type === 'revolute' || joint.type === 'continuous' ? 
                                 (clampedAngle * 180 / Math.PI).toFixed(2) : 
                                 clampedAngle.toFixed(3);
            const unit = joint.type === 'revolute' || joint.type === 'continuous' ? '°' : 'm';
            this.jointControls[jointName].textContent = `${displayValue}${unit}`;
            // Also update the slider's actual value
            const slider = document.getElementById(`range-${jointName}`);
            if (slider) {
                slider.value = joint.type === 'revolute' || joint.type === 'continuous' ? 
                                clampedAngle * 180 / Math.PI : 
                                clampedAngle;
            }
        }
    }

    createJointControls() {
        const jointControlsContainer = document.getElementById('jointControls');
        jointControlsContainer.innerHTML = ''; // Clear previous controls
        
        // Filter for joints that have limits or are continuous, to create meaningful sliders
        const controllableJoints = Object.values(this.joints).filter(
            j => (j.type === 'revolute' || j.type === 'continuous' || j.type === 'prismatic') && 
                 (j.limit.lower !== -Infinity && j.limit.upper !== Infinity || j.type === 'continuous')
        );

        if (controllableJoints.length === 0) {
            jointControlsContainer.innerHTML = '<p style="color: rgba(255,255,255,0.7);">No controllable joints found.</p>';
            return;
        }

        controllableJoints.forEach(joint => {
            const controlDiv = document.createElement('div');
            controlDiv.className = 'joint-control';

            const jointTypeUnit = joint.type === 'revolute' || joint.type === 'continuous' ? '°' : 'm'; // Degrees or meters
            
            // Get initial value from defaultPose or 0
            let initialSliderValue = 0; // Default slider to 0 or midpoint
            if (this.poseController && this.poseController.defaultPose && this.poseController.defaultPose[this.getHumanFriendlyJointName(joint.name)] !== undefined) {
                 initialSliderValue = this.poseController.defaultPose[this.getHumanFriendlyJointName(joint.name)];
                 if (joint.type === 'revolute' || joint.type === 'continuous') {
                     initialSliderValue = initialSliderValue * 180 / Math.PI; // Convert to degrees for slider
                 }
            }


            const lower = joint.type === 'revolute' || joint.type === 'continuous' ? joint.limit.lower * 180 / Math.PI : joint.limit.lower;
            const upper = joint.type === 'revolute' || joint.type === 'continuous' ? joint.limit.upper * 180 / Math.PI : joint.limit.upper;

            // Clamp initial value to limits to prevent slider issues
            initialSliderValue = Math.max(lower, Math.min(upper, initialSliderValue));


            controlDiv.innerHTML = `
                <div class="joint-header">
                    <span class="joint-name">${joint.name}</span>
                    <span class="joint-value" id="value-${joint.name}">${initialSliderValue.toFixed(2)}${jointTypeUnit}</span>
                </div>
                <input type="range" id="range-${joint.name}" 
                    min="${lower}" max="${upper}" step="0.01" value="${initialSliderValue}" />
            `;

            const rangeInput = controlDiv.querySelector(`#range-${joint.name}`);
            const valueSpan = controlDiv.querySelector(`#value-${joint.name}`);

            // Store valueSpan for programmatic updates (e.g., from MediaPipe)
            this.jointControls[joint.name] = valueSpan;

            // Manual slider control
            rangeInput.addEventListener('input', (e) => {
                // Temporarily disable MediaPipe control if manual slider is used
                if (this.poseController) {
                    this.poseController.disablePoseControl(); // You would implement this method
                }

                const angleValue = parseFloat(e.target.value);
                valueSpan.textContent = `${angleValue.toFixed(2)}${jointTypeUnit}`;

                // Convert back to radians if revolute/continuous
                const finalAngle = joint.type === 'revolute' || joint.type === 'continuous' ? angleValue * Math.PI / 180 : angleValue;
                this.updateJoint(joint.name, finalAngle);
            });
            
            // Re-enable MediaPipe control when slider is released (optional)
            rangeInput.addEventListener('mouseup', () => {
                if (this.poseController) {
                    this.poseController.enablePoseControl(); // You would implement this method
                }
            });


            jointControlsContainer.appendChild(controlDiv);
            
            // Set initial joint position based on the slider's initial value (which comes from defaultPose)
            this.updateJoint(joint.name, joint.type === 'revolute' || joint.type === 'continuous' ? initialSliderValue * Math.PI / 180 : initialSliderValue);
        });
    }

    // Helper to get human-friendly name from URDF name for defaultPose lookup
    getHumanFriendlyJointName(urdfName) {
        for (const key in this.poseController.jointMap) {
            if (this.poseController.jointMap[key] === urdfName) {
                return key;
            }
        }
        return urdfName; // Fallback if not found in map
    }

    onWindowResize() {
        const urdfCanvas = document.getElementById('urdfCanvas');
        const viewportDiv = document.getElementById('viewport');
        if (viewportDiv && urdfCanvas) {
            const width = viewportDiv.clientWidth;
            const height = viewportDiv.clientHeight;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
            
            // Also update overlay canvas size
            const overlayCanvas = document.getElementById('overlay');
            const webcamVideo = document.getElementById('webcam');
            if (overlayCanvas && webcamVideo) {
                overlayCanvas.width = webcamVideo.clientWidth;
                overlayCanvas.height = webcamVideo.clientHeight;
            }
        }
    }

    resetCameraView() {
        if (!this.robot) {
            this.updateStatus("No robot loaded to reset camera view for.", 'info');
            return;
        }

        const bbox = new THREE.Box3().setFromObject(this.robot);
        if (bbox.isEmpty()) {
            this.updateStatus("Robot bounding box is empty. Cannot reset camera view.", 'warning');
            return;
        }

        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        
        cameraZ *= 1.5; // Add some padding
        
        // Position camera relative to the center of the robot
        this.camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
        this.camera.lookAt(center);
        // If OrbitControls are used, update target
        // if (this.controls) {
        //     this.controls.target.copy(center);
        //     this.controls.update();
        // }
    }

    updateStatus(message, type) {
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = `status-${type}`;
        }
    }

    updateStats() {
        const linksCount = Object.keys(this.links).length;
        const jointsCount = Object.keys(this.joints).length;
        let triangleCount = 0;

        if (this.robot) {
            this.robot.traverse(object => {
                if (object.isMesh && object.geometry) {
                    if (object.geometry.isBufferGeometry) {
                        triangleCount += object.geometry.index ? object.geometry.index.count / 3 : object.geometry.attributes.position.count / 3;
                    }
                }
            });
        }

        // Ensure these elements exist before updating
        const statsLinks = document.getElementById('statsLinks');
        const statsJoints = document.getElementById('statsJoints');
        const statsTriangles = document.getElementById('statsTriangles');

        if (statsLinks) statsLinks.textContent = linksCount;
        if (statsJoints) statsJoints.textContent = jointsCount;
        if (statsTriangles) statsTriangles.textContent = triangleCount.toLocaleString(); // Format with commas
    }

    clearRobot() {
        if (this.robot) {
            this.scene.remove(this.robot);
            this.robot.traverse((object) => {
                if (object.isMesh) {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(material => material.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                }
            });
        }
        this.robot = null;
        this.joints = {};
        this.links = {};
        // Clear axes helpers from scene
        this.axesHelpers.forEach(axis => {
            if (axis.parent) axis.parent.remove(axis);
        });
        this.axesHelpers = [];
        this.jointControls = {}; // Clear UI controls
        document.getElementById('jointControls').innerHTML = ''; // Clear UI
        document.getElementById('jointSection').style.display = 'none'; // Hide joint controls section
        this.loadedGeometries.clear(); // Clear cached geometries
        this.updateStats(); // Reset stats display to 0
    }


    animate() {
        requestAnimationFrame(() => this.animate());

        // Update OrbitControls if enabled
        // if (this.controls) {
        //     this.controls.update();
        // }

        if (this.autoRotateEnabled) {
            if (this.robot) {
                this.robot.rotation.z += 0.005; // Gentle rotation
            }
        }

        // This line is crucial for rendering the 3D scene
        this.renderer.render(this.scene, this.camera);
    }
}


// Ensure the ProfessionalURDFViewer is instantiated, typically at the end of the file
window.addEventListener('DOMContentLoaded', () => {
    window.viewer = new ProfessionalURDFViewer();

    // Add initial stats display (can be 0 before robot is loaded)
    const statsDiv = document.createElement('div');
    statsDiv.id = 'stats';
    statsDiv.innerHTML = `
        <div class="stat-item"><span class="stat-label">Links:</span> <span class="stat-value" id="statsLinks">0</span></div>
        <div class="stat-item"><span class="stat-label">Joints:</span> <span class="stat-value" id="statsJoints">0</span></div>
        <div class="stat-item"><span class="stat-label">Triangles:</span> <span class="stat-value" id="statsTriangles">0</span></div>
    `;
    document.getElementById('viewport').appendChild(statsDiv);
    window.viewer.updateStats(); // Initial update to show zeros

    // Attach drag/drop classes
    const urdfWrapper = document.getElementById('urdfWrapper');
    const meshWrapper = document.getElementById('meshWrapper');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        if (urdfWrapper) urdfWrapper.addEventListener(eventName, e => e.preventDefault(), false);
        if (meshWrapper) meshWrapper.addEventListener(eventName, e => e.preventDefault(), false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        if (urdfWrapper) urdfWrapper.addEventListener(eventName, () => urdfWrapper.classList.add('drag-over'), false);
        if (meshWrapper) meshWrapper.addEventListener(eventName, () => meshWrapper.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        if (urdfWrapper) urdfWrapper.addEventListener(eventName, () => urdfWrapper.classList.remove('drag-over'), false);
        if (meshWrapper) meshWrapper.addEventListener(eventName, () => meshWrapper.classList.remove('drag-over'), false);
    });
});
