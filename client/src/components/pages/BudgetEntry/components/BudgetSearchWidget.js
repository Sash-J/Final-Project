import React from "react";

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
          <button
            className="bef-search-close-btn"
            onClick={() => {
              setSearchQuery("");
              setSearchOpen(false);
            }}
            title="Close search"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {searchQuery.trim() && (
          <div className="bef-search-status-bar">
            <span className="bef-search-matches-count">
              {searchResults.length > 0
                ? `${currentMatchIndex + 1} of ${searchResults.length}`
                : "No matches"}
            </span>
            <div className="bef-search-nav-buttons">
              <button
                onClick={handleSearchPrev}
                disabled={searchResults.length === 0}
                title="Previous match"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>arrow_upward</span>
              </button>
              <button
                onClick={handleSearchNext}
                disabled={searchResults.length === 0}
                title="Next match"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>arrow_downward</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetSearchWidget;
