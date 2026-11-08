import { startReader } from "./reader-app.mjs?v=share-icon-3";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
