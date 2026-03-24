---
title: "Curs-matrici-3"
description: "Transpunerea unei matrice"
---

## Ideea

Transpusa unei matrice M (n × p) este o matrice M<sup>T</sup> (p × n) unde rândurile devin coloane și coloanele devin rânduri.

M<sup>T</sup>[i][j] = M[j][i]

## Implementare

```cpp
int mt[100][100];  // matricea transpusă

for(i=0; i<n; i++)
    for(j=0; j<p; j++)
        mt[j][i] = m[i][j];

// acum mt are dimensiunile p x n
int temp = n;
n = p;
p = temp;
m = mt;
```

## Transpunere la loc (n = p)

Dacă matricea este pătratică, o poți transpune în loc:

```cpp
for(i=0; i<n; i++)
    for(j=i+1; j<n; j++)
        swap(m[i][j], m[j][i]);
```
