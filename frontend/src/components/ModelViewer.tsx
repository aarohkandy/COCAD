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
  const initializedCameraRef = useRef(false);
  const [status, setStatus] = useState("Waiting for accepted revision");

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
          <h2>Accepted Model</h2>
        </div>
        <div className="viewer-meta">
          <span className="viewer-status">{status}</span>
          {currentRevisionLabel ? <span className="viewer-revision">{currentRevisionLabel}</span> : null}
        </div>
      </header>
      <div ref={mountRef} className="viewer-canvas" />
      <footer className="viewer-footer">
        <section className="viewer-info-grid">
          <article className="viewer-info-card">
            <h3>Mass properties</h3>
            {massProperties ? (
              <dl className="metric-list">
                <div>
                  <dt>Volume</dt>
                  <dd>{massProperties.volume_mm3.toFixed(1)} mm3</dd>
                </div>
                <div>
                  <dt>Center</dt>
                  <dd>
                    {massProperties.center_of_mass_mm.map((value) => value.toFixed(1)).join(", ")} mm
                  </dd>
                </div>
                <div>
                  <dt>Bounding box</dt>
                  <dd>
                    {massProperties.bounding_box_mm.map((value) => value.toFixed(1)).join(" x ")} mm
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="card-muted">Mass properties will appear after the first accepted revision.</p>
            )}
          </article>

          <article className="viewer-info-card">
            <h3>Checker notes</h3>
            {checkerReport ? (
              <>
                <p className={checkerReport.passed ? "status-live" : "status-idle"}>
                  {checkerReport.summary}
                </p>
                <ul className="bullet-list bullet-list--compact">
                  {checkerReport.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="card-muted">Checker feedback appears after accepted revisions.</p>
            )}
          </article>
        </section>

        <section className="viewer-gallery">
          <div className="card-row">
            <h3>Render Gallery</h3>
            <span>{renderViews.length} views</span>
          </div>
          <div className="gallery-grid">
            {renderViews.map((view) => (
              <figure key={view.key} className="gallery-card">
                <img src={view.url} alt={view.label} loading="lazy" />
                <figcaption>{view.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>

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
