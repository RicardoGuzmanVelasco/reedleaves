import { startReader } from "./reader-app.mjs?v=feedback-swipe-2026-10-22";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
