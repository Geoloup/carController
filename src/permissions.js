export class PermissionHandler {
  constructor() {
    this.permissionOverlay = document.getElementById('camera-permission');
    this.grantPermissionBtn = document.getElementById('grant-permission');
    
    this.grantPermissionBtn.addEventListener('click', () => this.requestPermission());
  }

  async checkPermission() {
    try {
      const result = await navigator.permissions.query({ name: 'camera' });
      if (result.state === 'granted') {
        this.permissionOverlay.classList.add('hidden');
      } else {
        this.permissionOverlay.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Failed to check camera permission:', err);
      this.permissionOverlay.classList.remove('hidden');
    }
  }

  async requestPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      this.permissionOverlay.classList.add('hidden');
      return true;
    } catch (err) {
      console.error('Failed to get camera permission:', err);
      alert('Camera access is required for this application.');
      throw err;
    }
  }
}