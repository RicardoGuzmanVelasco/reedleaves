import { startReader } from "./reader-app.mjs?v=share-card-controls-2";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
