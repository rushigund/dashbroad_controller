import {
  PoseLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

export class MediaPipePoseController {
  constructor(viewerInstance, videoElement) {
    this.viewer = viewerInstance;
    this.video = videoElement;
    this.poseLandmarker = null;
    this.runningMode = "VIDEO";
    this.lastVideoTime = -1;
    this.webcamInitialized = false;

    this.prevAngles = {
      r_hip_y: 0,
      r_knee_y: 0,
      l_hip_y: 0,
      l_knee_y: 0,
      r_shoulder_y: 0,
      r_elbow_y: 0,
      l_shoulder_y: 0,
      l_elbow_y: 0,
      spine: 0,
      neck: 0
    };

    this.smoothingFactor = 0.4;
    this.initMediaPipe();
  }

  async initMediaPipe() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "./mediapipe_models/pose_landmarker_full (1).task", // Make sure this path is correct
        delegate: "CPU"
      },
      runningMode: this.runningMode,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    console.log("✅ MediaPipe PoseLandmarker initialized.");
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
            console.log("🎥 Webcam stream started. Starting pose detection.");
            this.detectPosesInRealTime();
          }, { once: true });
        })
        .catch((error) => {
          console.error("❌ Error accessing webcam:", error);
          this.viewer.updateStatus("Error accessing webcam: " + error.message, 'error');
        });
    } else {
      this.viewer.updateStatus("Webcam not supported by this browser.", 'error');
    }
  }

  async detectPosesInRealTime() {
    if (this.webcamInitialized && this.poseLandmarker) {
      const startTimeMs = performance.now();

      if (this.video.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.video.currentTime;

        try {
          const result = await this.poseLandmarker.detectForVideo(this.video, startTimeMs);
          if (result.landmarks && result.landmarks.length > 0) {
            this.drawLandmarks(result.landmarks[0]);
            this.mapPoseToRobot(result.landmarks[0]);
          }
        } catch (error) {
          console.error("❌ Pose detection error:", error);
        }
      }
    }

    requestAnimationFrame(this.detectPosesInRealTime.bind(this));
  }

  drawLandmarks(landmarks) {
    const ctx = this.overlayCtx;
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    ctx.save();
    ctx.translate(this.overlayCanvas.width, 0);
    ctx.scale(-1, 1);
    const scaleX = this.overlayCanvas.width;
    const scaleY = this.overlayCanvas.height;
    ctx.fillStyle = '#00FF00';
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    for (let i = 0; i < landmarks.length; i++) {
      const x = landmarks[i].x * scaleX;
      const y = landmarks[i].y * scaleY;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  mapPoseToRobot(landmarks) {
    const vertical = { x: 0, y: -1, z: 0 };
    const getVec = (a, b) => (!a || !b) ? { x: 0, y: 0, z: 0 } : { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const getAngle = (a, b) => {
      const dot = a.x * b.x + a.y * b.y + a.z * b.z;
      const mag1 = Math.sqrt(a.x ** 2 + a.y ** 2 + a.z ** 2);
      const mag2 = Math.sqrt(b.x ** 2 + b.y ** 2 + b.z ** 2);
      return (mag1 && mag2) ? Math.acos(Math.min(Math.max(dot / (mag1 * mag2), -1.0), 1.0)) : 0;
    };

    const v = (id) => landmarks[id] && landmarks[id].visibility > 0.5 ? landmarks[id] : null;

    // Legs
    const r_hip = v(24), r_knee = v(26), r_ankle = v(28);
    const l_hip = v(23), l_knee = v(25), l_ankle = v(27);
    if (r_hip && r_knee && r_ankle) {
      this.smoothJoint("r_hip_y", -getAngle(getVec(r_hip, r_knee), vertical), -1.5, 1.5);
      this.smoothJoint("r_knee_y", getAngle(getVec(r_knee, r_ankle), getVec(r_hip, r_knee)), 0, 2.0);
    }
    if (l_hip && l_knee && l_ankle) {
      this.smoothJoint("l_hip_y", -getAngle(getVec(l_hip, l_knee), vertical), -1.5, 1.5);
      this.smoothJoint("l_knee_y", getAngle(getVec(l_knee, l_ankle), getVec(l_hip, l_knee)), 0, 2.0);
    }

    // Arms
    const r_shoulder = v(12), r_elbow = v(14), r_wrist = v(16);
    const l_shoulder = v(11), l_elbow = v(13), l_wrist = v(15);
    if (r_shoulder && r_elbow && r_wrist) {
      this.smoothJoint("r_shoulder_y", -getAngle(getVec(r_shoulder, r_elbow), vertical), -1.5, 1.5);
      this.smoothJoint("r_elbow_y", getAngle(getVec(r_elbow, r_wrist), getVec(r_shoulder, r_elbow)), 0, 2.0);
    }
    if (l_shoulder && l_elbow && l_wrist) {
      this.smoothJoint("l_shoulder_y", -getAngle(getVec(l_shoulder, l_elbow), vertical), -1.5, 1.5);
      this.smoothJoint("l_elbow_y", getAngle(getVec(l_elbow, l_wrist), getVec(l_shoulder, l_elbow)), 0, 2.0);
    }

    // Spine & neck
    const leftHip = v(23), rightHip = v(24);
    const leftShoulder = v(11), rightShoulder = v(12);
    const nose = v(0);

    if (leftHip && rightHip && leftShoulder && rightShoulder) {
      const hipMid = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2, z: (leftHip.z + rightHip.z) / 2 };
      const shoulderMid = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2, z: (leftShoulder.z + rightShoulder.z) / 2 };
      this.smoothJoint("spine", -getAngle(getVec(hipMid, shoulderMid), vertical), -0.6, 0.6);
    }

    if (nose && leftShoulder && rightShoulder) {
      const shoulderMid = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2, z: (leftShoulder.z + rightShoulder.z) / 2 };
      this.smoothJoint("neck", getAngle(getVec(shoulderMid, nose), vertical), -0.6, 0.6);
    }
  }

  smoothJoint(name, targetAngle, min = -1.5, max = 1.5) {
    const prev = this.prevAngles[name] || 0;
    const alpha = this.smoothingFactor;
    let smoothed = prev * (1 - alpha) + targetAngle * alpha;
    smoothed = Math.max(min, Math.min(max, smoothed)); // Clamp
    // Disabled threshold temporarily for debugging:
    this.prevAngles[name] = smoothed;
    this.viewer.updateJoint(name, smoothed);
    console.log(`Updating ${name}: ${smoothed.toFixed(2)} rad`);
  }
}
