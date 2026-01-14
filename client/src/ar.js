import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';

let container;
let camera, scene, renderer;
let controller;
let reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;

const distanceSpan = document.getElementById('distance');
const overlayStatus = document.getElementById('overlay');

init();
animate();

function init() {
    container = document.createElement('div');
    document.body.appendChild(container);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    // AR Button handles the session request
    const arButton = ARButton.createButton(renderer, { 
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.body } 
    });
    
    // Replace our custom button with the official one (or hide ours)
    document.getElementById('ar-button').style.display = 'none';
    document.body.appendChild(arButton);

    // Reticle (the cursor)
    reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial()
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (hitTestSourceRequested === false) {
            session.requestReferenceSpace('viewer').then(function (referenceSpace) {
                session.requestHitTestSource({ space: referenceSpace }).then(function (source) {
                    hitTestSource = source;
                });
            });
            session.addEventListener('end', function () {
                hitTestSourceRequested = false;
                hitTestSource = null;
            });
            hitTestSourceRequested = true;
        }

        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);

            if (hitTestResults.length > 0) {
                const hit = hitTestResults[0];

                reticle.visible = true;
                reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
                
                // Calculate distance from camera to reticle
                // Camera position in XR is usually at (0,0,0) of the 'viewer' space, 
                // but we need its position in 'local'/'local-floor' space.
                // Actually, simplest way: Distance = magnitude of the position vector relative to viewer?
                // The hit test result is already in referenceSpace (usually local).
                // We need the camera position in the same space.
                
                const reticlePos = new THREE.Vector3();
                reticlePos.setFromMatrixPosition(reticle.matrix);

                const cameraPos = new THREE.Vector3();
                cameraPos.setFromMatrixPosition(camera.matrixWorld); // approximate

                // More accurate: get viewer pose
                const viewerPose = frame.getViewerPose(referenceSpace);
                if (viewerPose) {
                    const viewPos = viewerPose.views[0].transform.position;
                    const dist = Math.sqrt(
                        Math.pow(reticlePos.x - viewPos.x, 2) +
                        Math.pow(reticlePos.y - viewPos.y, 2) +
                        Math.pow(reticlePos.z - viewPos.z, 2)
                    );
                    distanceSpan.innerText = dist.toFixed(2);
                }

            } else {
                reticle.visible = false;
                distanceSpan.innerText = "--";
            }
        }
    }

    renderer.render(scene, camera);
}
