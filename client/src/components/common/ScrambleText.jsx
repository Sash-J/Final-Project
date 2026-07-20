import React, { useState, useEffect, useRef } from "react";

const UPPER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER_CHARS = "abcdefghijklmnopqrstuvwxyz";
const SPECIAL_CHARS = "!@#$%^&*()_+{}:\"<>?|[];',./`~";

const ScrambleText = ({
  text,
  as: Component = "span",
  className = "",
  hoverOnly = true,
  scrambleSpeed = 90,
  revealSpeed = 0.4,
}) => {
  const [displayText, setDisplayText] = useState(text || "");
  const intervalRef = useRef(null);

  useEffect(() => {
    setDisplayText(text || "");
  }, [text]);

  const scramble = () => {
    if (!text) return;

    let iteration = 0;
    clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setDisplayText((_) => {
        return text
          .split("")
          .map((letter, index) => {
            if (index < iteration) {
              return text[index];
            }
            if (letter === " ") return " ";

            // Try to match the case/type of the original character
            if (/[A-Z]/.test(letter)) {
              return UPPER_CHARS[
                Math.floor(Math.random() * UPPER_CHARS.length)
              ];
            } else if (/[a-z]/.test(letter)) {
              return LOWER_CHARS[
                Math.floor(Math.random() * LOWER_CHARS.length)
              ];
            } else {
              return SPECIAL_CHARS[
                Math.floor(Math.random() * SPECIAL_CHARS.length)
              ];
            }
          })
          .join("");
      });

      if (iteration >= text.length) {
        clearInterval(intervalRef.current);
      }

      iteration += revealSpeed;
    }, scrambleSpeed);
  };

  useEffect(() => {
    if (!hoverOnly) {
      scramble();
    }
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, hoverOnly]);

  const handleMouseEnter = () => {
    if (hoverOnly) {
      scramble();
    }
  };

  const handleMouseLeave = () => {
    if (hoverOnly) {
      setDisplayText(text || "");
      clearInterval(intervalRef.current);
    }
  };

  return (
    <Component
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {displayText}
    </Component>
  );
};

export default ScrambleText;
