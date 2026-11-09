import * as THREE from 'three';
// The live hauler and drill are built in worldlife.js. roverHi / roverLo / drillHi / drillLo / drillHeadGeo
// were unused meshes and are gone. The rig still anchors its spinning auger at DRILL_HEAD.
export const DRILL_HEAD = new THREE.Vector3(0, 1.05, -2.7);
