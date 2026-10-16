import { startReader } from "./reader-app.mjs?v=take-note-icon";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
