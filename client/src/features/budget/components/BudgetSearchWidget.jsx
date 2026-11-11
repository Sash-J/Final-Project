import React from "react";
import HoverTooltip from "../../../components/common/HoverTooltip";
import GlassSurface from "../../../components/effects/GlassSurface";
import "./BudgetSearchWidget.css";

const BudgetSearchWidget = ({
  searchOpen,
  setSearchOpen,
  searchInputRef,
  searchQuery,
  setSearchQuery,
  handleSearchKeyDown,
  searchResults,
  currentMatchIndex,
  handleSearchPrev,
  handleSearchNext,
}) => {
  const handleTriggerKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSearchOpen(true);
    }
  };

  return (
    <div className={`bef-search-widget ${searchOpen ? "expanded" : "collapsed"}`}>
      <HoverTooltip
        text={searchOpen ? "" : "Find budget items"}
        wrapperClassName="bef-search-trigger-tooltip"
      >
        <GlassSurface
          className="bef-floating-trigger-btn bef-search-trigger-btn"
          onClick={() => setSearchOpen(true)}
          onKeyDown={handleTriggerKeyDown}
          role="button"
          tabIndex={searchOpen ? -1 : 0}
          aria-label="Search budget items"
          width={48}
          height={48}
          borderRadius={24}
          blur={10}
          opacity={0}
          backgroundOpacity={0}
        >
          <span className="material-symbols-outlined">search</span>
        </GlassSurface>
      </HoverTooltip>
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
              className="no-global-input"
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
