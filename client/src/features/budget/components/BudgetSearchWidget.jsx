import React from "react";
import HoverTooltip from "../../../components/common/HoverTooltip";
import GlassSurface from "../../../components/common/GlassSurface";
import "./BudgetSearchWidget.css";

const BudgetSearchWidget = ({
  widgetRef,
  searchOpen,
  setSearchOpen,
  translateY,
  searchInputRef,
  searchQuery,
  setSearchQuery,
  handleSearchKeyDown,
  searchResults,
  currentMatchIndex,
  handleSearchPrev,
  handleSearchNext,
}) => {
  return (
    <div
      ref={widgetRef}
      className={`bef-search-widget ${searchOpen ? "expanded" : "collapsed"}`}
      style={{ transform: `translateY(${translateY}px)` }}
    >
      <GlassSurface
        className="bef-search-trigger-btn"
        onClick={() => setSearchOpen(true)}
        width={48}
        height={48}
        borderRadius={24}
        blur={10}
        opacity={0}
        backgroundOpacity={0}
      >
        <span className="material-symbols-outlined">search</span>
      </GlassSurface>
      <div className="bef-search-container">
        <GlassSurface
          className="bef-search-input-wrapper"
          width="100%"
          height="auto"
          borderRadius={10}
          blur={12}
          opacity={0}
          backgroundOpacity={0.2}
          distortionScale={80}
        >
          <div className="bef-search-top-row">
            <span className="material-symbols-outlined search-input-icon">
              search
            </span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Find items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            <HoverTooltip text="Close search">
              <button
                className="bef-search-close-btn"
                onClick={() => {
                  setSearchQuery("");
                  setSearchOpen(false);
                }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </HoverTooltip>
          </div>
          {searchQuery.trim() && (
            <div className="bef-search-status-bar">
              <span className="bef-search-matches-count">
                {searchResults.length > 0
                  ? `${currentMatchIndex + 1} of ${searchResults.length}`
                  : "No matches"}
              </span>
              <div className="bef-search-nav-buttons">
                <HoverTooltip text="Previous match">
                  <button
                    onClick={handleSearchPrev}
                    disabled={searchResults.length === 0}
                  >
                    <span className="material-symbols-outlined">
                      arrow_upward
                    </span>
                  </button>
                </HoverTooltip>
                <HoverTooltip text="Next match">
                  <button
                    onClick={handleSearchNext}
                    disabled={searchResults.length === 0}
                  >
                    <span className="material-symbols-outlined">
                      arrow_downward
                    </span>
                  </button>
                </HoverTooltip>
              </div>
            </div>
          )}
        </GlassSurface>
      </div>
    </div>
  );
};

export default BudgetSearchWidget;
