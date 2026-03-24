---
title: "Curs-matrici-4"
description: "Înmulțirea a două matrice"
---

## Regula

Dacă A (n × m) și B (m × p), atunci `C = A × B` are dimensiuni (n × p).

Elementul `C[i][j] = A[i][0]*B[0][j] + A[i][1]*B[1][j] + ... + A[i][m-1]*B[m-1][j]`

## Implementare

```cpp
int a[100][100], b[100][100], c[100][100];
int n, m, p;  // A: n x m, B: m x p, C: n x p

// inițializare c la 0
for(i=0; i<n; i++)
    for(j=0; j<p; j++)
        c[i][j] = 0;

// înmulțire
for(i=0; i<n; i++){
    for(j=0; j<p; j++){
        for(k=0; k<m; k++)
            c[i][j] += a[i][k] * b[k][j];
    }
}
```

## Observație

Înmulțirea de matrice NU este comutativă: `A×B ≠ B×A` (și uneori nici nu se poate efectua)
