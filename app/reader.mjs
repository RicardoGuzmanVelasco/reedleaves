import { startReader } from "./reader-app.mjs?v=typewriter-middle-speed";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
