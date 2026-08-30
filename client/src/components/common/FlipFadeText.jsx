import React, { useState, useEffect, useCallback } from "react";
import "./FlipFadeText.css";

const defaultWords = ["LOADING", "COMPUTING", "SEARCHING", "RETRIEVING", "ASSEMBLING"];

export function FlipFadeText({
  words = defaultWords,
  interval = 2500,
  className = "",
  staggerDelay = 0.1,
  exitStaggerDelay = 0.05,
}) {
  const [index, setIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(null);

  const updateIndex = useCallback(() => {
    setPrevIndex(index);
    setIndex((prev) => (prev + 1) % words.length);
  }, [index, words.length]);

  useEffect(() => {
    const timer = setInterval(updateIndex, interval);
    return () => clearInterval(timer);
  }, [updateIndex, interval]);

  // Clean up prevIndex after exit animation completes
  useEffect(() => {
    if (prevIndex !== null) {
      // Exit animation takes ~0.4s. Clean it up after 1s to be safe
      const timeout = setTimeout(() => {
        setPrevIndex(null);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [prevIndex]);

  const currentWord = words[index];
  const previousWord = prevIndex !== null ? words[prevIndex] : null;

  return (
    <div className={`flip-fade-container ${className}`}>
      <div className="flip-fade-scene">
        {/* Render previous word exiting */}
        {previousWord && (
          <div className="flip-fade-word exiting" key={`prev-${prevIndex}`}>
            {previousWord.split("").map((char, i) => (
              <span
                key={`${char}-${i}`}
                className="flip-fade-letter"
                style={{ animationDelay: `${i * exitStaggerDelay}s` }}
              >
                {char === " " ? "\u00A0" : char}
              </span>
            ))}
          </div>
        )}
        
        {/* Render current word entering */}
        <div className="flip-fade-word entering" key={`curr-${index}`}>
          {currentWord.split("").map((char, i) => (
            <span
              key={`${char}-${i}`}
              className="flip-fade-letter"
              style={{ animationDelay: `${i * staggerDelay}s` }}
            >
              {char === " " ? "\u00A0" : char}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FlipFadeText;
