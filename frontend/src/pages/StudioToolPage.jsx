import React from "react";
import ComingSoon from "../components/ComingSoon.jsx";

export default function StudioToolPage({ title, description, icon }) {
  return (
    <ComingSoon
      title={title}
      description={`${description || ""} This tool is not available yet — check back soon.`}
      icon={icon || "construction"}
    />
  );
}
