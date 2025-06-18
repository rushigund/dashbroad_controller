import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js";

export class MediaPipeHandController {
    constructor(viewerInstance, videoElement) {
        this.viewer = viewerInstance;
        this.video = videoElement;
        this.handLandmarker = null;
        this.runningMode = "VIDEO";
        this.lastVideoTime = -1;
        this.webcamInitialized = false;

        this.initMediaPipe();
    }

    async initMediaPipe() {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: './mediapipe_models/hand_landmarker.task',  // Fully hardcoded path
                delegate: "CPU"
            },
            numHands: 1,
            runningMode: this.runningMode
        });
        console.log("MediaPipe HandLandmarker initialized.");

        this.setupWebcam();
    }

    setupWebcam() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then((stream) => {
                    this.video.srcObject = stream;
                    this.video.addEventListener("canplay", () => {
                        this.video.play();
                        
                        this.overlayCanvas = document.getElementById("overlay");
                        this.overlayCanvas.width = this.video.videoWidth;
                        this.overlayCanvas.height = this.video.videoHeight;
                        this.overlayCtx = this.overlayCanvas.getContext("2d");

                        this.webcamInitialized = true;
                        console.log("Webcam stream started. Starting hand detection loop.");
                        this.detectHandsInRealTime();
                    }, { once: true });
                })
                .catch((error) => {
                    console.error("Error accessing webcam:", error);
                    this.viewer.updateStatus("Error accessing webcam: " + error.message, 'error');
                });
        } else {
            this.viewer.updateStatus("Webcam not supported by this browser.", 'error');
        }
    }

    async detectHandsInRealTime() {
        if (this.webcamInitialized && this.handLandmarker) {
            let startTimeMs = Math.round(performance.now() * 1000);

            if (this.video.currentTime !== this.lastVideoTime) {
                this.lastVideoTime = this.video.currentTime;
                
                try {
                    const result = await this.handLandmarker.detectForVideo(this.video, startTimeMs);
                    if (result.landmarks && result.landmarks.length > 0) {
                        // Add this line to log the landmarks to the console
                        console.log("Hand Landmarks:", result.landmarks[0]);
                        this.mapLandmarksToRobot(result.landmarks[0]);
                        this.drawLandmarks(result.landmarks[0]);
                    }
                } catch (error) {
                    console.error("Hand detection error:", error);
                }
            }
        }
        requestAnimationFrame(this.detectHandsInRealTime.bind(this));
    }

    drawLandmarks(landmarks) {
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        
        // Save the current state of the canvas
        this.overlayCtx.save();
        
        // Flip the canvas horizontally to un-mirror the drawing
        this.overlayCtx.translate(this.overlayCanvas.width, 0);
        this.overlayCtx.scale(-1, 1);

        const scaleX = this.overlayCanvas.width;
        const scaleY = this.overlayCanvas.height;

        // Define connections for the hand skeleton
        const connections = [
            // Thumb
            [0, 1], [1, 2], [2, 3], [3, 4],
            // Index finger
            [0, 5], [5, 6], [6, 7], [7, 8],
            // Middle finger
            [9, 10], [10, 11], [11, 12],
            // Ring finger
            [13, 14], [14, 15], [15, 16],
            // Pinky finger
            [0, 17], [17, 18], [18, 19], [19, 20],
            // Palm base
            [0, 1], [0, 5], [5, 9], [9, 13], [13, 17]
        ];

        // Draw connections (skeleton)
        this.overlayCtx.strokeStyle = '#33aaff'; // A vibrant blue for lines
        this.overlayCtx.lineWidth = 5; // Increased line width for connections
        for (const connection of connections) {
            const start = landmarks[connection[0]];
            const end = landmarks[connection[1]];
            
            if (start && end) {
                this.overlayCtx.beginPath();
                this.overlayCtx.moveTo(start.x * scaleX, start.y * scaleY);
                this.overlayCtx.lineTo(end.x * scaleX, end.y * scaleY);
                this.overlayCtx.stroke();
            }
        }

        // Draw landmarks (points)
        this.overlayCtx.fillStyle = '#FF4136'; // Red for landmarks
        this.overlayCtx.strokeStyle = '#FFFFFF'; // White border
        this.overlayCtx.lineWidth = 2; // Increased line width for landmark borders
        for (let i = 0; i < landmarks.length; i++) {
            const x = landmarks[i].x * scaleX;
            const y = landmarks[i].y * scaleY;
            
            this.overlayCtx.beginPath();
            this.overlayCtx.arc(x, y, 7, 0, 2 * Math.PI); // Increased radius for landmarks
            this.overlayCtx.fill();
            this.overlayCtx.stroke(); // Draw border
        }

        // Optional: Color code different parts of the hand
        const fingerColors = [
            '#FF851B', // Orange for Thumb (landmarks 1-4)
            '#2ECC40', // Green for Index (landmarks 5-8)
            '#FFDC00', // Yellow for Middle (landmarks 9-12)
            '#7FDBFF', // Light Blue for Ring (landmarks 13-16)
            '#B10DC9'  // Purple for Pinky (landmarks 17-20)
        ];

        const fingerLandmarkIndices = [
            [1, 2, 3, 4],    // Thumb
            [5, 6, 7, 8],    // Index
            [9, 10, 11, 12], // Middle
            [13, 14, 15, 16],// Ring
            [17, 18, 19, 20] // Pinky
        ];

        for (let f = 0; f < fingerLandmarkIndices.length; f++) {
            this.overlayCtx.fillStyle = fingerColors[f];
            for (const index of fingerLandmarkIndices[f]) {
                const x = landmarks[index].x * scaleX;
                const y = landmarks[index].y * scaleY;
                this.overlayCtx.beginPath();
                this.overlayCtx.arc(x, y, 7, 0, 2 * Math.PI);
                this.overlayCtx.fill();
                this.overlayCtx.stroke();
            }
        }

        // Base of the hand/palm (landmark 0) - often useful to highlight
        this.overlayCtx.fillStyle = '#F012BE'; // Pink for the palm base
        this.overlayCtx.beginPath();
        this.overlayCtx.arc(landmarks[0].x * scaleX, landmarks[0].y * scaleY, 10, 0, 2 * Math.PI);
        this.overlayCtx.fill();
        this.overlayCtx.stroke();

        // Restore the canvas state
        this.overlayCtx.restore();
    }

    mapLandmarksToRobot(handLandmarks) {
        // Joint mapping based on your whiteboard notes
        const jointMapping = {
            thumb: { landmarks: [1, 2, 3, 4], joints: ['joint_12', 'joint_13', 'joint_14', 'joint_15'] },
            index: { landmarks: [5, 6, 7, 8], joints: ['joint_0', 'joint_1', 'joint_2', 'joint_3'] },
            middle: { landmarks: [9, 10, 11, 12], joints: ['joint_4', 'joint_5', 'joint_6', 'joint_7'] },
            ring: { landmarks: [13, 14, 15, 16], joints: ['joint_8', 'joint_9', 'joint_10', 'joint_11'] }
            // Pinky ignored as noted
        };
    
        // Helper function to calculate angle between two vectors
        const calculateAngle = (v1, v2) => {
            const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
            const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
            const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
            
            if (mag1 === 0 || mag2 === 0) return 0;
            
            const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
            return Math.acos(cosAngle);
        };
    
        // Helper function to create vector between two landmarks
        const createVector = (from, to) => ({
            x: to.x - from.x,
            y: to.y - from.y,
            z: to.z - from.z || 0 // Handle 2D coordinates
        });
    
        // Helper function to calculate finger bend angle
        const calculateFingerBend = (allLandmarks, fingerLandmarkIndices) => {
            const angles = [];
            
            for (let i = 0; i < fingerLandmarkIndices.length - 2; i++) {
                const p1 = allLandmarks[fingerLandmarkIndices[i]];
                const p2 = allLandmarks[fingerLandmarkIndices[i + 1]];
                const p3 = allLandmarks[fingerLandmarkIndices[i + 2]];
                
                if (!p1 || !p2 || !p3) {
                    angles.push(0);
                    continue;
                }
    
                // Create vectors for the bone segments
                const v1 = createVector(p2, p1); // Vector from joint to previous point
                const v2 = createVector(p2, p3); // Vector from joint to next point
                
                // Calculate the bend angle (supplement of the angle between vectors)
                const angle = Math.PI - calculateAngle(v1, v2);
                angles.push(angle);
            }
            
            return angles;
        };
    
        // Calculate abduction angle (side-to-side movement)
        const calculateAbduction = (allLandmarks, fingerLandmarkIndices, palmCenter) => {
            const fingerBase = allLandmarks[fingerLandmarkIndices[0]];
            const fingerTip = allLandmarks[fingerLandmarkIndices[fingerLandmarkIndices.length - 1]];
            
            if (!fingerBase || !fingerTip || !palmCenter) return 0;
            
            // Create vectors
            const palmToBase = createVector(palmCenter, fingerBase);
            const baseToTip = createVector(fingerBase, fingerTip);
            
            // Project onto horizontal plane (assuming y is up)
            palmToBase.y = 0;
            baseToTip.y = 0;
            
            // Calculate angle in horizontal plane
            return calculateAngle(palmToBase, baseToTip) - Math.PI/2;
        };
    
        // Get palm center (approximate center of palm)
        const palmCenter = {
            x: (handLandmarks[0].x + handLandmarks[5].x + handLandmarks[9].x + handLandmarks[13].x + handLandmarks[17].x) / 5,
            y: (handLandmarks[0].y + handLandmarks[5].y + handLandmarks[9].y + handLandmarks[13].y + handLandmarks[17].y) / 5,
            z: ((handLandmarks[0].z || 0) + (handLandmarks[5].z || 0) + (handLandmarks[9].z || 0) + (handLandmarks[13].z || 0) + (handLandmarks[17].z || 0)) / 5
        };
    
        // Process each finger
        Object.entries(jointMapping).forEach(([fingerName, mapping]) => {
            const { landmarks: landmarkIndices, joints: jointNames } = mapping;
            
            // Get landmark points for this finger
            const fingerLandmarks = landmarkIndices.map(idx => handLandmarks[idx]);
            
            // Calculate bend angles for the finger segments
            const bendAngles = calculateFingerBend(handLandmarks, landmarkIndices);
            
            // Calculate abduction angle for the base joint
            const abductionAngle = calculateAbduction(handLandmarks, landmarkIndices, palmCenter);
            
            // Map angles to joints
            jointNames.forEach((jointName, jointIndex) => {
                let angle = 0;
                
                if (jointIndex === 0) {
                    // First joint: abduction/adduction
                    angle = abductionAngle * 0.5; // Scale down for realistic movement
                } else if (jointIndex - 1 < bendAngles.length) {
                    // Bend joints: use calculated bend angles
                    angle = bendAngles[jointIndex - 1] * 0.8; // Scale for realistic movement
                    
                    // Apply coupling for natural finger motion
                    if (jointIndex === 2) {
                        angle += bendAngles[0] * 0.3; // PIP influenced by MCP
                    } else if (jointIndex === 3) {
                        angle += bendAngles[0] * 0.2 + bendAngles[1] * 0.4; // DIP influenced by previous joints
                    }
                }
                
                // Apply joint limits (approximate human finger limits)
                if (fingerName === 'thumb') {
                    angle = Math.max(-0.5, Math.min(1.5, angle));
                } else {
                    angle = Math.max(-0.2, Math.min(1.8, angle));
                }
                
                // Apply smoothing (simple exponential smoothing)
                if (!this.previousAngles) this.previousAngles = {};
                if (this.previousAngles[jointName] !== undefined) {
                    const smoothingFactor = 0.7;
                    angle = this.previousAngles[jointName] * (1 - smoothingFactor) + angle * smoothingFactor;
                }
                this.previousAngles[jointName] = angle;
                
                // Update the robot joint
                if (this.viewer && this.viewer.updateJoint) {
                    this.viewer.updateJoint(jointName, angle);
                }
                
                // Debug output (uncomment for debugging)
                // console.log(`${fingerName} ${jointName}: ${angle.toFixed(3)} rad`);
            });
        });
    
        // Optional: Update status with joint info
        if (this.viewer && this.viewer.updateStatus) {
            const activeJoints = Object.keys(this.previousAngles || {}).length;
            this.viewer.updateStatus(`Hand tracking active - controlling ${activeJoints} joints`, 'success');
        }
    }
}