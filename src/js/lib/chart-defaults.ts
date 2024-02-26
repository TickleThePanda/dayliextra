export function createTitle(title: string) {
  return {
    display: true,
    text: title,
    align: "start",
    font: {
      size: 24,
      weight: "normal",
    },
    padding: {
      bottom: 5,
    },
    color: "#333333",
  };
}
export function createSubtitle(subtitle: string) {
  return {
    display: true,
    text: subtitle,
    align: "start",
    font: {
      size: 16,
      weight: "normal",
      lineHeight: 1,
    },
    padding: {
      bottom: 20,
    },
    color: "#333333",
  };
}