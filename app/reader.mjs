import { startReader } from "./reader-app.mjs?v=share-card-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
