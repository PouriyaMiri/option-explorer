import { FixedSizeList as List } from 'react-window';
import { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';

const columnWidths = {
  '#': 30,
  field: 120,
  domain: 120,
  intent: 120,
  'sub-model': 120,
  layers: 65,
  nodes: 80,
  activation_function: 150,
  kernel_size: 100,
  pool_size: 100,
  batch_size: 100,
  epochs: 100,
  processing_unit: 150,
  RAM: 45,
  loss: 80,
  accuracy: 100,
  recall: 100,
  precision: 100,
  f1_score: 100,
  training_time: 120,
  algorithm: 120,
  model: 120,
};

const getTotalTableWidth = () => {
  return Object.values(columnWidths).reduce((sum, width) => sum + width, 0);
};

const DataTable = ({ onRowSelect, onSortChange, selectedRow, csvUrl = '/data/data.csv', showFieldFilter = true, onDataLoaded,rows: initialRows }) => {
  const [data, setData] = useState(initialRows || []);
  const [headers, setHeaders] = useState([]);
  const [selectedField, setSelectedField] = useState('');
  const [uniqueFields, setUniqueFields] = useState([]);
  const [sortColumns, setSortColumns] = useState([]);
  const [fieldKey, setFieldKey] = useState('');
  const [loading, setLoading] = useState(!initialRows || initialRows.length === 0);

  useEffect(() => {
    if (initialRows && initialRows.length >0){
	const headersFromRows = Object.keys(initialRows[0]);
	const headersTrimmed = headersFromRows.map((h) => h.trim());

	setHeaders(headersTrimmed);
	setData(initialRows);
	if (onDataLoaded) onDataLoaded(initialRows);

	const lowerHeaderMap = headersTrimmed.reduce((acc, h) => {
	   acc[h.toLowerCase()] = h;
	   return acc;
	},{});
	const actualFieldKey = lowerHeaderMap['field'];
	setFieldKey(actualFieldKey);
	if (actualFieldKey) {
		const unique = initialRows
		   .map((row) => row?.[actualFieldKey])
		   .filter((f, i, arr) => f && arr.indexOf(f) === i);
		setUniqueFields(unique);
	}
	setLoading(false);
	return;

    }


    if (!csvUrl){
	setLoading(false);
	return;
    }

    setLoading(true);
 
    fetch(csvUrl)
      .then((response) => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.text();
      })
      .then((text) => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.data.length > 0) {
              const rawHeaders = Object.keys(results.data[0]);
              const headers = rawHeaders.map(h => h.trim());

              const normalizedData = results.data.map(row => {
                const cleaned = {};
                rawHeaders.forEach((raw, i) => {
                  const rawTrimmed = raw.trim();
                  const cleanKey = headers[i];
                  cleaned[cleanKey] = row?.[rawTrimmed]?.toString().trim() || '';
                });
                return cleaned;
              });

              setHeaders(headers);
              setData(normalizedData);
              if (onDataLoaded) onDataLoaded(normalizedData);

              const lowerHeaderMap = headers.reduce((acc, h) => {
                acc[h.toLowerCase()] = h;
                return acc;
              }, {});
              const actualFieldKey = lowerHeaderMap['field'];
              setFieldKey(actualFieldKey);

              if (actualFieldKey) {
                const unique = normalizedData
                  .map(row => row?.[actualFieldKey])
                  .filter((f, i, arr) => f && arr.indexOf(f) === i);
                setUniqueFields(unique);
              }
            }
	      setLoading(false);
          },
        });
      })
      .catch((error) => {
        console.error('Failed to fetch CSV:', error);
      });
  }, [csvUrl, onDataLoaded, initialRows]);

  const filteredData = useMemo(() => {
    if (!selectedField || !fieldKey) return data;
    return data.filter(row => row[fieldKey] === selectedField);
  }, [data, selectedField, fieldKey]);

  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      for (let col of sortColumns) {
        if (a[col] > b[col]) return -1;
        if (a[col] < b[col]) return 1;
      }
      return 0;
    });
    return sorted;
  }, [filteredData, sortColumns]);

  const handleSort = (header) => {
    const newSortColumns = [...sortColumns];
    const index = newSortColumns.indexOf(header);

    if (index !== -1) newSortColumns.splice(index, 1);
    else {
      newSortColumns.push(header);
      if (newSortColumns.length > 3) newSortColumns.shift();
    }

    setSortColumns(newSortColumns);
    onSortChange(newSortColumns);
  };

  if (data.length && !sortedData.length) {
    return <p className="mt-4 text-red-600">No results match your filter.</p>;
  }

  if (loading) return <p className="mt-4">Loading data…</p>;
  if (!data.length) return <p className="mt-4">No rows found.</p>;

  return (
    <div className="mt-6 overflow-auto" style={{
      height: '60vh',
      margin: '0 auto',
      border: '2px solid #1C39BB',
      borderRadius: '8px',
      fontFamily: 'Arial, sans-serif',
    }}>
      {/* Filter Controls */}
      <div className="p-4 flex flex-wrap gap-2 items-center bg-[#F0F4FF] border-b border-[#1C39BB]">
        <label htmlFor="field-select" className="mr-2 font-bold text-[#1C39BB]">
          Filter by Field
        </label>
        <select
          id="field-select"
          value={selectedField}
          onChange={(e) => setSelectedField(e.target.value)}
          className="border border-[#1C39BB] rounded px-2 py-1 w-full sm:w-auto"
        >
          <option value="">-- All Fields --</option>
          {uniqueFields.map((field, i) => (
            <option key={i} value={field}>{field}</option>
          ))}
        </select>
      </div>

      {showFieldFilter && (
        <div className="p-4 flex flex-wrap gap-2 items-center bg-[#F0F4FF] border-b border-[#1C39BB]">
          <label htmlFor="field-select" className="mr-2 font-bold text-[#1C39BB]">
            Filter by Field
          </label>
          <select
            id="field-select"
            value={selectedField}
            onChange={(e) => setSelectedField(e.target.value)}
            className="border border-[#1C39BB] rounded px-2 py-1 w-full sm:w-auto"
          >
            <option value="">-- All Fields --</option>
            {uniqueFields.map((field, i) => (
              <option key={i} value={field}>{field}</option>
            ))}
          </select>
        </div>
      )}

      {/* Single horizontal scrollbar for both header + rows */}
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <div style={{ width: getTotalTableWidth() }}>
          {/* Table Headers */}
          <div
            style={{
              display: 'flex',
              fontWeight: 'bold',
              borderBottom: '2px solid #1C39BB',
              backgroundColor: '#1C39BB',
              color: 'white',
            }}
          >
            <div style={{ width: columnWidths['#'], padding: '4px' }}>#</div>
            {headers.map((header, i) => (
              <div
                key={i}
                style={{
                  width: columnWidths[header] || 100,
                  padding: '4px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                onClick={() => handleSort(header)}
                title={header}
              >
                {header}{sortColumns.includes(header) ? ' ▼' : ''}
              </div>
            ))}
          </div>
          {/* Table Rows */}
          <List
            height={400}
            itemCount={sortedData.length}
            itemSize={40}
            width={getTotalTableWidth()}
          >
            {({ index, style }) => {
              const row = sortedData[index];
              const isSelected = selectedRow && selectedRow === row;

              return (
                <div
                  style={{
                    ...style,
                    display: 'flex',
                    borderBottom: '1px solid #1C39BB',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#CC3333' : index % 2 === 0 ? '#F0F4FF' : '#FFFFFF',
                    color: isSelected ? '#FFFFFF' : '#1C39BB',
                  }}
                  onClick={() => onRowSelect(row)}
                >
                  <div style={{ width: columnWidths['#'], padding: '4px', fontWeight: 'bold' }}>{index + 1}</div>
                  {headers.map((header, j) => {
                    const value = row?.[header]?.toString().trim() || '-';
                    return (
                      <div
                        key={j}
                        style={{
                          width: columnWidths[header] || 100,
                          padding: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={value}
                      >
                        {value}
                      </div>
                    );
                  })}
                </div>
              );
            }}
          </List>
        </div>
      </div>
    </div>
  );
};

export default DataTable;
