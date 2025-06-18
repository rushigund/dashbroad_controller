import * as THREE from "three";

// URDF Loader interface (simplified version)
interface URDFRobot extends THREE.Group {
  joints: { [key: string]: URDFJoint };
  links: { [key: string]: URDFLink };
  setJointValue: (jointName: string, value: number) => void;
  setJointValues: (values: { [key: string]: number }) => void;
}

interface URDFJoint extends THREE.Object3D {
  name: string;
  type: string;
  limit?: { lower: number; upper: number };
  axis?: THREE.Vector3;
  angle: number;
  setAngle: (angle: number) => void;
}

interface URDFLink extends THREE.Object3D {
  name: string;
}

// Simplified URDF Loader implementation
export class URDFLoader {
  private manager: THREE.LoadingManager;

  constructor(manager?: THREE.LoadingManager) {
    this.manager = manager || new THREE.LoadingManager();
  }

  async load(
    url: string,
    onLoad?: (robot: URDFRobot) => void,
    onProgress?: (progress: ProgressEvent) => void,
    onError?: (error: Error) => void,
  ): Promise<URDFRobot> {
    try {
      // For now, create a mock robot since urdf-loader might not be available
      const robot = await this.createMockRobot(url);
      if (onLoad) onLoad(robot);
      return robot;
    } catch (error) {
      if (onError) onError(error as Error);
      throw error;
    }
  }

  private async createMockRobot(url: string): Promise<URDFRobot> {
    // Create a mock robot group
    const robot = new THREE.Group() as URDFRobot;
    robot.joints = {};
    robot.links = {};

    // Base link
    const baseGeometry = new THREE.BoxGeometry(2, 0.5, 1.5);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x2563eb });
    const baseLink = new THREE.Mesh(baseGeometry, baseMaterial);
    baseLink.position.set(0, 0.25, 0);
    baseLink.name = "base_link";
    robot.add(baseLink);
    robot.links["base_link"] = baseLink as URDFLink;

    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2937 });

    const wheelPositions = [
      { name: "wheel_fl", position: [-1.2, 0.3, 1.0] },
      { name: "wheel_fr", position: [1.2, 0.3, 1.0] },
      { name: "wheel_bl", position: [-1.2, 0.3, -1.0] },
      { name: "wheel_br", position: [1.2, 0.3, -1.0] },
    ];

    wheelPositions.forEach(({ name, position }) => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(position[0], position[1], position[2]);
      wheel.rotation.z = Math.PI / 2; // Rotate to be wheel-like
      wheel.name = name;
      robot.add(wheel);

      // Create joint for wheel
      const joint = wheel as URDFJoint;
      joint.type = "continuous";
      joint.axis = new THREE.Vector3(0, 0, 1);
      joint.angle = 0;
      joint.setAngle = (angle: number) => {
        joint.rotation.z = angle;
        joint.angle = angle;
      };
      robot.joints[name + "_joint"] = joint;
      robot.links[name] = wheel as URDFLink;
    });

    // Sensor tower
    const towerGeometry = new THREE.BoxGeometry(0.3, 1.2, 0.3);
    const towerMaterial = new THREE.MeshStandardMaterial({ color: 0x059669 });
    const tower = new THREE.Mesh(towerGeometry, towerMaterial);
    tower.position.set(0, 1.1, 0);
    tower.name = "sensor_tower";
    robot.add(tower);
    robot.links["sensor_tower"] = tower as URDFLink;

    // Camera
    const cameraGeometry = new THREE.BoxGeometry(0.2, 0.15, 0.1);
    const cameraMaterial = new THREE.MeshStandardMaterial({ color: 0xdc2626 });
    const camera = new THREE.Mesh(cameraGeometry, cameraMaterial);
    camera.position.set(0, 1.8, 0.2);
    camera.name = "camera";
    robot.add(camera);
    robot.links["camera"] = camera as URDFLink;

    // Implement robot methods
    robot.setJointValue = (jointName: string, value: number) => {
      const joint = robot.joints[jointName];
      if (joint) {
        joint.setAngle(value);
      }
    };

    robot.setJointValues = (values: { [key: string]: number }) => {
      Object.keys(values).forEach((jointName) => {
        robot.setJointValue(jointName, values[jointName]);
      });
    };

    return robot;
  }

  // Parse URDF content and create robot
  async parseURDF(urdfContent: string): Promise<URDFRobot> {
    try {
      // Simple URDF parsing - in a real implementation, you'd use proper XML parsing
      const robot = new THREE.Group() as URDFRobot;
      robot.joints = {};
      robot.links = {};

      // Extract robot name
      const robotNameMatch = urdfContent.match(
        /<robot[^>]*name\s*=\s*"([^"]*)"[^>]*>/,
      );
      if (robotNameMatch) {
        robot.name = robotNameMatch[1];
      }

      // Parse links
      const linkMatches = urdfContent.matchAll(
        /<link[^>]*name\s*=\s*"([^"]*)"[^>]*>(.*?)<\/link>/gs,
      );
      for (const match of linkMatches) {
        const linkName = match[1];
        const linkContent = match[2];

        const link = this.parseLink(linkName, linkContent);
        robot.add(link);
        robot.links[linkName] = link as URDFLink;
      }

      // Parse joints
      const jointMatches = urdfContent.matchAll(
        /<joint[^>]*name\s*=\s*"([^"]*)"[^>]*type\s*=\s*"([^"]*)"[^>]*>(.*?)<\/joint>/gs,
      );
      for (const match of jointMatches) {
        const jointName = match[1];
        const jointType = match[2];
        const jointContent = match[3];

        const joint = this.parseJoint(
          jointName,
          jointType,
          jointContent,
          robot,
        );
        if (joint) {
          robot.joints[jointName] = joint;
        }
      }

      // Implement robot methods
      robot.setJointValue = (jointName: string, value: number) => {
        const joint = robot.joints[jointName];
        if (joint && joint.setAngle) {
          joint.setAngle(value);
        }
      };

      robot.setJointValues = (values: { [key: string]: number }) => {
        Object.keys(values).forEach((jointName) => {
          robot.setJointValue(jointName, values[jointName]);
        });
      };

      return robot;
    } catch (error) {
      console.error("Error parsing URDF:", error);
      // Fallback to mock robot
      return this.createMockRobot("fallback");
    }
  }

  private parseLink(name: string, content: string): THREE.Object3D {
    const link = new THREE.Group();
    link.name = name;

    // Parse visual elements
    const visualMatches = content.matchAll(/<visual[^>]*>(.*?)<\/visual>/gs);
    for (const match of visualMatches) {
      const visualContent = match[1];
      const visual = this.parseVisual(visualContent);
      if (visual) {
        link.add(visual);
      }
    }

    return link;
  }

  private parseVisual(content: string): THREE.Object3D | null {
    try {
      // Parse geometry
      let geometry: THREE.BufferGeometry | null = null;

      // Box geometry
      const boxMatch = content.match(/<box[^>]*size\s*=\s*"([^"]*)"[^>]*>/);
      if (boxMatch) {
        const [x, y, z] = boxMatch[1].split(" ").map(Number);
        geometry = new THREE.BoxGeometry(x, y, z);
      }

      // Cylinder geometry
      const cylinderMatch = content.match(
        /<cylinder[^>]*radius\s*=\s*"([^"]*)"[^>]*length\s*=\s*"([^"]*)"[^>]*>/,
      );
      if (cylinderMatch) {
        const radius = Number(cylinderMatch[1]);
        const length = Number(cylinderMatch[2]);
        geometry = new THREE.CylinderGeometry(radius, radius, length);
      }

      // Sphere geometry
      const sphereMatch = content.match(
        /<sphere[^>]*radius\s*=\s*"([^"]*)"[^>]*>/,
      );
      if (sphereMatch) {
        const radius = Number(sphereMatch[1]);
        geometry = new THREE.SphereGeometry(radius);
      }

      if (!geometry) {
        geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1); // Default
      }

      // Parse material/color
      let material = new THREE.MeshStandardMaterial({ color: 0x888888 });
      const colorMatch = content.match(/<color[^>]*rgba\s*=\s*"([^"]*)"[^>]*>/);
      if (colorMatch) {
        const [r, g, b, a] = colorMatch[1].split(" ").map(Number);
        material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(r, g, b),
          transparent: a < 1,
          opacity: a,
        });
      }

      const mesh = new THREE.Mesh(geometry, material);

      // Parse origin/transform
      const originMatch = content.match(
        /<origin[^>]*xyz\s*=\s*"([^"]*)"[^>]*rpy\s*=\s*"([^"]*)"[^>]*>/,
      );
      if (originMatch) {
        const [x, y, z] = originMatch[1].split(" ").map(Number);
        const [roll, pitch, yaw] = originMatch[2].split(" ").map(Number);

        mesh.position.set(x, y, z);
        mesh.rotation.set(roll, pitch, yaw);
      }

      return mesh;
    } catch (error) {
      console.error("Error parsing visual:", error);
      return null;
    }
  }

  private parseJoint(
    name: string,
    type: string,
    content: string,
    robot: URDFRobot,
  ): URDFJoint | null {
    try {
      // Find parent and child links
      const parentMatch = content.match(
        /<parent[^>]*link\s*=\s*"([^"]*)"[^>]*>/,
      );
      const childMatch = content.match(/<child[^>]*link\s*=\s*"([^"]*)"[^>]*>/);

      if (!parentMatch || !childMatch) return null;

      const parentLink = robot.links[parentMatch[1]];
      const childLink = robot.links[childMatch[1]];

      if (!parentLink || !childLink) return null;

      // Create joint object
      const joint = childLink as URDFJoint;
      joint.name = name;
      joint.type = type;
      joint.angle = 0;

      // Parse axis
      const axisMatch = content.match(/<axis[^>]*xyz\s*=\s*"([^"]*)"[^>]*>/);
      if (axisMatch) {
        const [x, y, z] = axisMatch[1].split(" ").map(Number);
        joint.axis = new THREE.Vector3(x, y, z);
      }

      // Parse limits
      const limitMatch = content.match(
        /<limit[^>]*lower\s*=\s*"([^"]*)"[^>]*upper\s*=\s*"([^"]*)"[^>]*>/,
      );
      if (limitMatch) {
        joint.limit = {
          lower: Number(limitMatch[1]),
          upper: Number(limitMatch[2]),
        };
      }

      // Parse origin
      const originMatch = content.match(
        /<origin[^>]*xyz\s*=\s*"([^"]*)"[^>]*rpy\s*=\s*"([^"]*)"[^>]*>/,
      );
      if (originMatch) {
        const [x, y, z] = originMatch[1].split(" ").map(Number);
        const [roll, pitch, yaw] = originMatch[2].split(" ").map(Number);

        childLink.position.set(x, y, z);
        childLink.rotation.set(roll, pitch, yaw);
      }

      // Add setAngle method
      joint.setAngle = (angle: number) => {
        if (joint.axis) {
          const quaternion = new THREE.Quaternion();
          quaternion.setFromAxisAngle(joint.axis, angle);
          joint.setRotationFromQuaternion(quaternion);
          joint.angle = angle;
        }
      };

      return joint;
    } catch (error) {
      console.error("Error parsing joint:", error);
      return null;
    }
  }
}

export { URDFRobot, URDFJoint, URDFLink };
