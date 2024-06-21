import { createSystem } from "frog/ui";

export const { Box, Columns, Column, Image, Heading, Text, VStack, Spacer, vars } = createSystem({
  colors: {
    bg: "rgb(0,82,254)",
    white: "white",
    black: "rgb(32,49,71)",
    orange: "rgb(252,78,55)",
    grey: 'rgba(255, 255, 255, 0.5)',
  },
  fonts: {
    default: [
      {
        name: 'Space Mono',
        source: 'google',
      },
    ],
  },
});