# Landing Page Design for Manus AI

## Goal
To create a dynamic landing page with three interactive sections: 'Analytics', 'Search', and 'Classic File Storage'. The 'Search' section will be active by default. Clicking on any side section will bring it to the center, while the previously centered section moves to the side, adjusting its dimensions to create an attractive visual transition.

## Technologies
- **React**: For component-based UI development and state management.
- **Tailwind CSS**: For utility-first styling and responsive design.
- **JavaScript**: For handling dynamic interactions and state changes.

## Core Components

### 1. `HomePage` Component (Main Container)
This will be the root component, managing the overall layout and the state of the active tab.

**State Management:**
- `activeTab`: A state variable to keep track of the currently centered tab (e.g., 'analytics', 'search', 'classic'). Initial state will be 'search'.

**Layout Structure:**
- The `HomePage` will contain three main `div` elements, each representing a tab: `AnalyticsTab`, `SearchTab`, and `ClassicFileStorageTab`.
- These `div`s will be arranged using Flexbox to allow for dynamic reordering and resizing.

### 2. Tab Components (`AnalyticsTab`, `SearchTab`, `ClassicFileStorageTab`)
Each of these will be a functional React component responsible for rendering its specific content.

**Props:**
- `isActive`: A boolean indicating if the tab is currently centered.
- `onClick`: A function to call when the tab is clicked, to update the `activeTab` state in `HomePage`.
- `darkMode`: (Inherited from the provided snippet) for theme management.

## Dynamic Layout and Styling (Tailwind CSS & JavaScript)

### Initial State (Search Tab Active)
- **Search Tab**: Will occupy the central and largest portion of the screen (e.g., `w-[50%]`).
- **Analytics Tab (Left)**: Will occupy a smaller portion (e.g., `w-[25%]`), positioned to the left.
- **Classic File Storage Tab (Right)**: Will occupy a smaller portion (e.g., `w-[25%]`), positioned to the right.

### Transition on Click
When a side tab is clicked:
1.  The `activeTab` state in `HomePage` will be updated to the clicked tab's identifier.
2.  Based on the `activeTab` state, conditional Tailwind CSS classes will be applied to each tab component.
    - The newly active tab will receive classes for the central, larger width (e.g., `w-[50%]`).
    - The previously active tab will receive classes for a side, smaller width (e.g., `w-[25%]`) and be repositioned to the appropriate side.
    - The third tab will remain on its side with the smaller width.
3.  CSS `transition` properties (e.g., `transition-all duration-500 ease-in-out`) will be used to ensure smooth visual changes in width and position.

**Example of Conditional Styling Logic (within `HomePage` or individual tab components):**

```jsx
<div className={`flex flex-row h-full`}>
  <AnalyticsTab isActive={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
  <SearchTab isActive={activeTab === 'search'} onClick={() => setActiveTab('search')} />
  <ClassicFileStorageTab isActive={activeTab === 'classic'} onClick={() => setActiveTab('classic')} />
</div>
```

And inside each `Tab` component:

```jsx
const Tab = ({ isActive, onClick, children }) => {
  const widthClass = isActive ? 'w-[50%]' : 'w-[25%]';
  const orderClass = isActive ? 'order-2' : (// Logic to determine order based on which side it should be);
  return (
    <div
      onClick={onClick}
      className={`h-full ${widthClass} ${orderClass} transition-all duration-500 ease-in-out flex justify-center items-center border shadow-lg rounded-3xl cursor-pointer`}
    >
      {children}
    </div>
  );
};
```

### Responsive Design Considerations
- Use Tailwind's responsive prefixes (e.g., `md:w-[50%]`, `lg:w-[33%]`) to adjust the layout for different screen sizes.
- On smaller screens, the layout might stack vertically or use a carousel-like navigation if the three-column layout becomes too cramped.

## User Interaction
- Clicking on any of the three main tab areas will trigger the layout change.
- The content within the active tab will be fully visible and interactive.
- Side tabs will have a visually distinct appearance (e.g., reduced opacity, smaller font size) to indicate they are not active, but still clickable.

## Visual Elements
- The provided code snippet already includes styling for the search input and filter buttons, which will be integrated into the `SearchTab`.
- Placeholder content for 'Analytics' and 'Classic File Storage' will be used initially, with the expectation that actual content will be added later.

This design ensures a clear, interactive, and visually appealing landing page experience as requested by the user.
