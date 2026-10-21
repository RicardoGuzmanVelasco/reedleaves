import { startReader } from "./reader-app.mjs?v=navigation-backdrop-2";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
