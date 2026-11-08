import { startReader } from "./reader-app.mjs?v=soil-rosebud-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
