import { startReader } from "./reader-app.mjs?v=reading-guides-2";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
