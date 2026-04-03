import { useEffect, useRef, useState } from "react";
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  LoadingManager,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { ArtifactLink } from "../types";

interface ModelViewerProps {
  modelUrl: string | null;
  downloads: ArtifactLink[];
}

export function ModelViewer({ modelUrl, downloads }: ModelViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<Group | null>(null);
  const initializedCameraRef = useRef(false);
  const [status, setStatus] = useState("Waiting for model");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const scene = new Scene();
    scene.background = new Color("#f1e7d8");
    scene.add(new AmbientLight("#ffffff", 1.8));

    const keyLight = new DirectionalLight("#fff4dc", 2.1);
    keyLight.position.set(5, 8, 10);
    scene.add(keyLight);

    const fillLight = new DirectionalLight("#bfd8ff", 1.2);
    fillLight.position.set(-8, 6, -6);
    scene.add(fillLight);

    const grid = new GridHelper(18, 18, "#d1b598", "#e7d6c1");
    grid.position.y = -1.1;
    scene.add(grid);

    const camera = new PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(5, 5, 7);

    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.6, 0);
    controls.update();

    mount.appendChild(renderer.domElement);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    const onResize = () => {
      if (!mount || !rendererRef.current || !cameraRef.current) {
        return;
      }
      rendererRef.current.setSize(mount.clientWidth, mount.clientHeight);
      cameraRef.current.aspect = mount.clientWidth / mount.clientHeight;
      cameraRef.current.updateProjectionMatrix();
    };

    window.addEventListener("resize", onResize);

    let frameId = 0;
    const render = () => {
      frameId = window.requestAnimationFrame(render);
      controls.update();
      renderer.render(scene, camera);
    };
    render();

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (!modelUrl || !sceneRef.current || !cameraRef.current || !controlsRef.current) {
      setStatus("Waiting for model");
      return;
    }

    setStatus("Loading GLB");
    const loader = new GLTFLoader(
      new LoadingManager(
        () => setStatus("Model ready"),
        () => undefined,
        () => setStatus("Failed to load model"),
      ),
    );
    loader.load(
      modelUrl,
      (gltf) => {
        if (!sceneRef.current || !cameraRef.current || !controlsRef.current) {
          return;
        }

        if (modelRef.current) {
          sceneRef.current.remove(modelRef.current);
        }

        modelRef.current = gltf.scene;
        sceneRef.current.add(gltf.scene);

        if (!initializedCameraRef.current) {
          const bounds = new Box3().setFromObject(gltf.scene);
          const size = bounds.getSize(new Vector3());
          const center = bounds.getCenter(new Vector3());
          const distance = Math.max(size.x, size.y, size.z) * 2 || 6;

          cameraRef.current.position.set(center.x + distance, center.y + distance, center.z + distance);
          controlsRef.current.target.copy(center);
          controlsRef.current.update();
          initializedCameraRef.current = true;
        }

        setStatus("Model ready");
      },
      undefined,
      () => setStatus("Failed to load model"),
    );
  }, [modelUrl]);

  return (
    <section className="viewer-panel">
      <header className="panel-header">
        <div>
          <p className="eyebrow">VIEWER</p>
          <h2>Static GLB Preview</h2>
        </div>
        <span className="viewer-status">{status}</span>
      </header>
      <div ref={mountRef} className="viewer-canvas" />
      <footer className="viewer-footer">
        <p>Orbit, pan, and zoom stay stable while the model reference changes.</p>
        <div className="download-row">
          {downloads.map((download) => (
            <a key={download.label} className="download-button" href={download.url} target="_blank" rel="noreferrer">
              {download.label}
            </a>
          ))}
        </div>
      </footer>
    </section>
  );
}
