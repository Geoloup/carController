import { ViewMode } from './view-mode.js';
import { CameraMode } from './camera-mode.js';
import { PermissionHandler } from './permissions.js';

// Global variables
let currentMode = 'client';
let viewMode;
let cameraMode;
let permissionHandler;

// DOM Elements - Mode Selection
const clientModeBtn = document.getElementById('client-mode-btn');
const cameraModeBtn = document.getElementById('camera-mode-btn');
const clientInterface = document.getElementById('client-interface');
const cameraInterface = document.getElementById('camera-interface');

// Switch between modes
function switchMode(mode) {
  currentMode = mode;

  // Update UI
  clientModeBtn.classList.remove('active');
  cameraModeBtn.classList.remove('active');
  clientInterface.classList.add('hidden');
  cameraInterface.classList.add('hidden');

  switch (mode) {
    case 'client':
      clientModeBtn.classList.add('active');
      clientInterface.classList.remove('hidden');
      if (!viewMode) {
        viewMode = new ViewMode();
        viewMode.initialize();
      }
      break;
    case 'camera':
      cameraModeBtn.classList.add('active');
      cameraInterface.classList.remove('hidden');
      if (!cameraMode) {
        cameraMode = new CameraMode();
        cameraMode.initialize();
      }
      break;
  }
}

// Initialize the application
async function initialize() {
  // Initialize permission handler
  permissionHandler = new PermissionHandler();
  await permissionHandler.checkPermission();

  // Set up mode selection
  clientModeBtn.addEventListener('click', () => switchMode('client'));
  cameraModeBtn.addEventListener('click', () => switchMode('camera'));
  
  // Initialize based on default mode (client/server mode)
  switchMode('client');
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);