import { useMemo } from 'react';

import { GroupRow, GroupByDictionary, Dictionary } from '../types';
import { getVerticalRangeToRender } from '../utils';

interface ViewportRowsArgs<R, SR> {
  rawRows: readonly R[];
  rowHeight: number;
  clientHeight: number;
  scrollTop: number;
  groupBy: readonly string[];
  rowGrouper?: (rows: readonly R[], columnKey: string) => Dictionary<R[]>;
  expandedGroupIds?: Set<unknown>;
}

export function useViewportRows<R, SR>({
  rawRows,
  rowHeight,
  clientHeight,
  scrollTop,
  groupBy,
  rowGrouper,
  expandedGroupIds
}: ViewportRowsArgs<R, SR>) {
  const [groupedRows, rowsCount] = useMemo(() => {
    if (groupBy.length === 0 || !rowGrouper) return [undefined, rawRows.length];

    const groupRows = (rows: readonly R[], [groupByKey, ...remainingGroupByKeys]: readonly string[]): [GroupByDictionary<R>, number] => {
      let rowsCount = 0;
      const groups: GroupByDictionary<R> = {};
      for (const [key, childRows] of Object.entries(rowGrouper(rows, groupByKey))) {
        // Recursively group each parent group
        const [childGroups, childRowsCount] = remainingGroupByKeys.length === 0 ? [childRows, childRows.length] : groupRows(childRows, remainingGroupByKeys);
        rowsCount += childRowsCount + 1; // 1 for parent row
        groups[key] = { childRows, childGroups };
      }

      return [groups, rowsCount];
    };

    return groupRows(rawRows, groupBy);
  }, [groupBy, rowGrouper, rawRows]);

  const rows = useMemo(() => {
    if (!groupedRows) return rawRows;

    const expandGroup = (rows: GroupByDictionary<R> | R[], parentKey: string | undefined, level: number): Array<GroupRow<R> | R> => {
      if (Array.isArray(rows)) return rows;
      const flattenedRows: Array<R | GroupRow<R>> = [];
      Object.keys(rows).forEach((key, index, keys) => {
        const id = parentKey !== undefined ? `${parentKey}__${key}` : key;
        const isExpanded = expandedGroupIds?.has(id) ?? false;
        const { childRows, childGroups } = rows[key];
        flattenedRows.push({
          id,
          key,
          isExpanded,
          childRows,
          level,
          setSize: keys.length,
          posInSet: index + 1, // aria-posinset is 1-based
          __isGroup: true
        });
        if (isExpanded) {
          flattenedRows.push(...expandGroup(childGroups, key, level + 1));
        }
      });

      return flattenedRows;
    };

    return expandGroup(groupedRows, undefined, 1); // aria-level is 1-based
  }, [expandedGroupIds, groupedRows, rawRows]);

  const [rowOverscanStartIdx, rowOverscanEndIdx] = getVerticalRangeToRender(
    clientHeight,
    rowHeight,
    scrollTop,
    rows.length
  );

  const viewportRows = rows.slice(rowOverscanStartIdx, rowOverscanEndIdx + 1);

  return {
    viewportRows,
    rows,
    startRowIdx: rowOverscanStartIdx,
    rowsCount
  };
}
