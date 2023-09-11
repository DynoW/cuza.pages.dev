import React from 'react';


const data = await import.meta.glob(
    "/public/files/fizica/**/*.pdf"
);


const categories = {};

for (const file in data) {
    data[file]();
    const filePath = file.replace("/public/files/fizica/", "");
    const pathParts = filePath.split("/");

    let currentCategory = categories;

    pathParts.forEach((subDirectory, index) => {
        if (!currentCategory[subDirectory]) {
            if (index === pathParts.length - 1) {
                currentCategory[subDirectory] = pathParts;
            } else {
                currentCategory[subDirectory] = {};
            }
        }
        currentCategory = currentCategory[subDirectory];
    });


    currentCategory = pathParts;
}

const altele = [];
var bac = [];
var teste = [];

for (var key in categories) {
    if (key == "altele") {
        for (key in categories["altele"]) {
            altele.push(categories["altele"][key])
        }
    }
    if (key == "bac") {
        bac = categories["bac"]
    }
}

class MyComponent extends React.Component {
    listDir(dict) {
        if (typeof dict !== 'object' || dict === null || Array.isArray(dict)) {
            return
        }

        return (
            <div>
                {Object.entries(dict).map(([key, value]) => (
                    <div key={key}>
                        <p>{key}</p>

                        {this.listDir(value)}
                    </div>
                ))}
            </div>
        );
    }

    render() {
        return this.listDir(bac);
    }
}

export default MyComponent;
