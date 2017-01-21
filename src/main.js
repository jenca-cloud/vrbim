/* global THREE */
/* global THREEx */
/* global GamepadState */


import request from 'superagent';

import * as BimManager from './BimManager';
import * as Navigator from './Navigator';
import * as Teleporter from './Teleporter';
import * as Menu from './Menu';
import * as WorldManager from './WorldManager';
import * as Cleaner from './Cleaner';

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 10000);
const controls = new THREE.VRControls(camera);
const dolly = new THREE.Group();
const raycaster  = new THREE.Raycaster();
const scene = new THREE.Scene();
const keyboard = new THREEx.KeyboardState();

const gamepadState = new GamepadState();

let teleportOn = true;
let onMenu = false;
let keyboardOn = true;
let renderer, canvas, effect;

let crosshair, VRManager, teleporter, ground;

const init = () => {
  camera.position.set(0, 5, 10);

  crosshair = Navigator.initCrosshair();
  camera.add(crosshair);

  canvas = document.getElementById('viewportCanvas');
  renderer = new THREE.WebGLRenderer({canvas: canvas, antialias:true});
  renderer.setPixelRatio(window.devicePixelRatio);
  effect = new THREE.VREffect(renderer);

  controls.standing = true;

  dolly.add(camera);

  const vertexShader = document.getElementById( 'vertexShader' ).textContent;
  const fragmentShader = document.getElementById( 'fragmentShader' ).textContent;
  const skybox = WorldManager.createSkybox(fragmentShader, vertexShader);
  ground = WorldManager.createGround();
  const lights = WorldManager.createLights();

  scene.add(dolly, skybox, ground, lights.hemiLight, lights.directionalLight);


  effect.setSize(window.innerWidth, window.innerHeight);
  VRManager = new WebVRManager(renderer, effect);

  //BimManager.loadEnvironment('senaatintori.js', scene);

  Menu.createPaletteToggle(dolly);
  Menu.createGuiToggle(dolly);
  Menu.createGui(camera, renderer, scene, dolly);

  initResize();
  setClickListeners();
  requestAnimationFrame(animate);

  document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    return false;
  }, false);

  gamepadState.ongearvrinput = function (gearVRAction) {
    if (gearVRAction == 'tap') {
      const menu = Menu.getIntersectedMenu(camera, raycaster);
      if (menu) {
        if (menu.name == 'PaletteToggle') {
          togglePalette();
        } else if (menu.name == 'GuiToggle'){
          Menu.toggleGui(dolly);
        } else if (menu.name == 'Palette'){
          BimManager.toggleMaterial(menu);
        }
      } else if (teleportOn && !onMenu && teleporter && VRManager.mode == 3) {
        moveDollyTo(dolly, {x: teleporter.position.x, y: teleporter.position.y, z: teleporter.position.z}, 500);
      }
    }
    if (gearVRAction == 'tapdown') {
      Menu.gazeDown();
    } else if (gearVRAction == 'tapup') {
      Menu.gazeUp();
    }
  };
};

const initResize = () => {
  onWindowResize();
  setResizeListeners();
};

const setResizeListeners = () => {
  window.addEventListener('resize', onWindowResize, true);
  window.addEventListener('vrdisplaypresentchange', onVRWindowResize, true);
};

const onWindowResize = () => {
  const width = document.getElementById('viewport').offsetWidth;
  const height = window.innerHeight;
  resizeWindow(width, height);
};

const onVRWindowResize = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  resizeWindow(width, height);
};

const resizeWindow = (width, height) => {
  camera.aspect = width / height;
  effect.setSize(width, height);
  camera.updateProjectionMatrix();
};

const setClickListeners = () => {
  const viewport = document.getElementById('viewport');
  viewport.addEventListener('mousedown', clickHandler, false);
}

const clickHandler = (event) => {
  const menu = Menu.getIntersectedMenu(camera, raycaster);
  if (menu) {
    if (menu.name == 'PaletteToggle') {
      togglePalette();
    } else if (menu.name == 'GuiToggle'){
      Menu.toggleGui(dolly);
    } else if (menu.name == 'Palette') {
      BimManager.toggleMaterial(menu);
    }
  } else if (teleportOn && !onMenu && teleporter && (VRManager.mode == 3 || (event && event.button == 2))) {
    moveDollyTo(dolly, {x: teleporter.position.x, y: teleporter.position.y, z: teleporter.position.z});
    if (event) event.stopPropagation();
  }
}

const togglePalette = () => {
  Menu.togglePalette(dolly, camera, renderer);
  toggleNavigation();
}

var lastRender = 0;
const animate = (timestamp) => {

  requestAnimationFrame(animate);
  lastRender = timestamp;
  controls.update();
  render();

  VRManager.render(scene, camera, timestamp, function() {});
};

const getIntersectedObj = () => {
  raycaster.setFromCamera( { x: 0, y: 0 }, camera );
  const intersects = raycaster.intersectObjects([ground, BimManager.getObject(), BimManager.getEnvironment()]);
  if (intersects.length < 1) {
    return null;
  }
  return intersects[0];
};

const moveDollyTo = (dolly, pos) => {
  dolly.position.set(pos.x, pos.y, pos.z);
}

const render = () => {
  Menu.updateMenuPosition(camera);
  gamepadState.update();

  if (teleportOn) {
    checkTeleport();
  }

  if (keyboardOn) {
    checkKeyboard();
  }
};


const lbounds = new THREE.Vector3(-1000, 0.5, -1000);
const ubounds = new THREE.Vector3(1000, 200, 1000);
const hspeed = 100;
const vspeed = 100;
const vstep = 0.3;
const hstep = 0.3;
const rot = 3.14/180 * 5;
const cwd = new THREE.Vector3(0,0,0);
const yaxis = new THREE.Vector3(0,1,0);

const checkKeyboard = () => {

  if (keyboard.pressed('W') || keyboard.pressed('up')) {
    camera.getWorldDirection(cwd);

    dolly.position.x += cwd.x*hstep;
    dolly.position.z += cwd.z*hstep;
  }

  if (keyboard.pressed('S') || keyboard.pressed('down')) {
    camera.getWorldDirection(cwd);

    dolly.position.x += cwd.x* (-hstep);
    dolly.position.z += cwd.z* (-hstep);
  }

  if (keyboard.pressed('D')) {
    camera.getWorldDirection(cwd);
    cwd.applyAxisAngle(yaxis, Math.PI / 2);

    dolly.position.x += cwd.x* (-hstep);
    dolly.position.z += cwd.z* (-hstep);
  }

  if (keyboard.pressed('A')) {
    camera.getWorldDirection(cwd);
    cwd.applyAxisAngle(yaxis, Math.PI / 2);

    dolly.position.x += cwd.x* hstep;
    dolly.position.z += cwd.z* hstep;
  }

  if (keyboard.pressed('Q') || keyboard.pressed('left')) {
    dolly.rotateY(rot);
  }

  if (keyboard.pressed('E') || keyboard.pressed('right')) {
    dolly.rotateY(-rot);
  }

  if (keyboard.pressed('R') || keyboard.pressed('.')) {
    dolly.position.y += vstep;

  }
  if (keyboard.pressed('F') || keyboard.pressed(',')) {
    dolly.position.y -= vstep;
  }
  if (keyboard.pressed('space')) {
    toggleMenu();
  }

  dolly.position.clamp(lbounds, ubounds);

}


const toggleNavigation = () => {
  if (teleportOn) {
    Cleaner.disposeHierarchy(teleporter);
    scene.remove(teleporter);
    teleporter = null;
  }
  teleportOn = !teleportOn;
}

const checkTeleport = () => {
  if (!teleporter) {
    teleporter = Teleporter.createTeleporter();
    scene.add(teleporter);
  }

  const obj = getIntersectedObj();
  if (obj && obj.point) {
    teleporter.position.set(obj.point.x, obj.point.y, obj.point.z);
  }
}

const loadModel = (name) => {
  BimManager.loadModelToScene(name, scene, () => {
    //menuParent = Menu.createMenu(dolly, BimManager.getMaterials());
  });
};

window.onload = function() {
   init();
};

window.loadModel = loadModel;
