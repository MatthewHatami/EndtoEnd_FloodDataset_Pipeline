# Flood Dataset Generation Pipeline

This repository contains a complete end-to-end pipeline to generate flood datasets for machine learning and remote sensing studies using Sentinel-1 SAR imagery.

The pipeline is composed of two stages:

---

## 1️⃣ Flood Mapping with Google Earth Engine (GEE)

The first step performs flood detection and mask generation using Sentinel-1 SAR images and auxiliary datasets (elevation, permanent water, slope filtering, etc.).

### Key steps:
- Automatically retrieve SAR images (before and after flood event).
- Apply speckle filtering (Refined Lee filter).
- Perform change detection using SAR backscatter ratio.
- Apply masking:
  - Permanent water bodies (using JRC Global Surface Water).
  - Steep slopes (using HydroSHEDS DEM).
  - Small disconnected objects (spatial cleaning).
- Calculate total flooded area.
- Export:
  - Flood mask (GeoTIFF)
  - Before and After SAR images (GeoTIFF)
  - Permanent water mask (GeoTIFF)
  - Flood extent as shapefile (vector)

👉 **Location**:  
- `flood_mapping_gee.js` (Google Earth Engine script)

---

## 2️⃣ Dataset Preparation and Chip Extraction (Python)

The second step processes the exported rasters locally to generate training-ready image chips.

### Key steps:
- Read exported SAR and flood mask rasters.
- Split large images into smaller image tiles (chips).
- Filter chips based on flood presence threshold.
- Export the final chips for model training.

👉 **Location**:  
- `preprocessing.ipynb` (Python Jupyter Notebook)

---

## 💻 Dependencies

- Google Earth Engine account (for Stage 1)
- Python 3.x (for Stage 2)
- Python libraries:
  - `rasterio`
  - `numpy`
  - `opencv-python`
  - `Pillow`
  - `tqdm`

---

## 🗺 Use Case

This pipeline allows researchers to:

- Generate high-quality flood datasets from SAR imagery.
- Automate flood mapping using GEE.
- Prepare training-ready datasets for deep learning models.

---

## 📊 Applications

- Flood segmentation model training
- Flood detection algorithm benchmarking
- Remote sensing data augmentation
- Disaster response datasets

---

## ⚠️ Notes

- You can modify the GEE script to apply to any area of interest and date range.
- The chip extraction code can be adjusted to different chip sizes or thresholds.

---

## 🌊 Author

> Created by [Your Name].  
> If you use this code for your research, feel free to cite or reference.

---

## 📞 Contact

For questions or collaborations, feel free to contact me on [LinkedIn](https://www.linkedin.com).

