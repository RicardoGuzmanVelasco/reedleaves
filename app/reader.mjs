import { startReader } from "./reader-app.mjs?v=level-up-polish-2";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
