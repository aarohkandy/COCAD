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

import type { ArtifactLink, CheckerReport, MassProperties, RenderView } from "../types";

interface ModelViewerProps {
  modelUrl: string | null;
  downloads: ArtifactLink[];
  renderViews: RenderView[];
  massProperties: MassProperties | null;
  checkerReport: CheckerReport | null;
  currentRevisionLabel: string | null;
}

export function ModelViewer({
  modelUrl,
  downloads,
  renderViews,
  massProperties,
  checkerReport,
  currentRevisionLabel,
}: ModelViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<Group | null>(null);
  const [status, setStatus] = useState("Waiting for accepted revision");
  const hasDiagnostics = Boolean(downloads.length > 0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const scene = new Scene();
    scene.background = new Color("#161b1b");
    scene.add(new AmbientLight("#ffffff", 1.55));

    const keyLight = new DirectionalLight("#ffe6c5", 1.9);
    keyLight.position.set(5, 8, 10);
    scene.add(keyLight);

    const fillLight = new DirectionalLight("#b8e1d6", 0.95);
    fillLight.position.set(-8, 6, -6);
    scene.add(fillLight);

    const grid = new GridHelper(18, 18, "#38534a", "#24302e");
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
      setStatus("Waiting for accepted revision");
      return;
    }

    setStatus("Loading accepted GLB");
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
        fitCameraToObject(gltf.scene, cameraRef.current, controlsRef.current);
        setStatus("Model ready");
      },
      undefined,
      () => setStatus("Failed to load model"),
    );
  }, [modelUrl]);

  return (
    <section className="viewer-panel">
      <header className="viewer-hero">
        <div className="viewer-hero-copy">
          <p className="eyebrow">COCAD</p>
          <h2>Viewer</h2>
          <p className="viewer-subcopy">
            Only accepted revisions appear here.
          </p>
        </div>
        <div className="viewer-meta">
          <span className="status-pill status-pill--ghost">{status}</span>
          {currentRevisionLabel ? <span className="status-pill status-pill--live">{currentRevisionLabel}</span> : null}
        </div>
      </header>
      <div className="viewer-stage">
        <div ref={mountRef} className="viewer-canvas" />
        {!modelUrl ? (
          <div className="viewer-empty-state">
            <p className="summary-label">No accepted revision yet</p>
            <h3>The model will appear here after the first successful step.</h3>
          </div>
        ) : null}
      </div>
      {hasDiagnostics ? (
        <footer className="viewer-footer">
          <div className="viewer-compact-meta">
            {massProperties ? (
              <span className="viewer-meta-chip">
                {massProperties.bounding_box_mm.map((value) => value.toFixed(0)).join(" x ")} mm
              </span>
            ) : null}
            {checkerReport ? (
              <span className="viewer-meta-chip">{checkerReport.summary}</span>
            ) : null}
            {renderViews.length > 0 ? <span className="viewer-meta-chip">{renderViews.length} renders</span> : null}
          </div>
          <div className="download-row">
            {downloads.map((download) => (
              <a key={download.label} className="download-button" href={download.url} target="_blank" rel="noreferrer">
                {download.label}
              </a>
            ))}
          </div>
        </footer>
      ) : null}
    </section>
  );
}

function fitCameraToObject(object: Group, camera: PerspectiveCamera, controls: OrbitControls) {
  const bounds = new Box3().setFromObject(object);
  if (bounds.isEmpty()) {
    return;
  }

  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const maxSize = Math.max(size.x, size.y, size.z) || 1;
  const fitHeightDistance = maxSize / (2 * Math.tan((camera.fov * Math.PI) / 360));
  const fitWidthDistance = fitHeightDistance / Math.max(camera.aspect, 0.1);
  const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.45;
  const offset = new Vector3(1, 0.65, 1).normalize().multiplyScalar(distance);

  camera.position.copy(center).add(offset);
  camera.near = Math.max(distance / 100, 0.1);
  camera.far = distance * 100;
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.minDistance = Math.max(maxSize * 0.45, 0.1);
  controls.maxDistance = Math.max(distance * 6, 10);
  controls.update();
}
