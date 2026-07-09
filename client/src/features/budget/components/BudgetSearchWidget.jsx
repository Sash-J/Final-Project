import React from "react";
import HoverTooltip from "../../../components/common/HoverTooltip";
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
      <button
        className="bef-search-trigger-btn glass-sandblasted"
        onClick={() => setSearchOpen(true)}
      >
        <span className="material-symbols-outlined">search</span>
      </button>
      <div className="bef-search-card glass-sandblasted">
        <div className="bef-search-input-wrapper">
          <span className="material-symbols-outlined search-input-icon">search</span>
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
                  <span className="material-symbols-outlined">arrow_upward</span>
                </button>
              </HoverTooltip>
              <HoverTooltip text="Next match">
                <button
                  onClick={handleSearchNext}
                  disabled={searchResults.length === 0}
                >
                  <span className="material-symbols-outlined">arrow_downward</span>
                </button>
              </HoverTooltip>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetSearchWidget;
