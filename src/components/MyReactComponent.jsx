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
            }
            else {
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
var index = 0
class MyComponent extends React.Component {
    listDir(dict) {
        if (typeof dict !== 'object' || dict === null || Array.isArray(dict)) {
            return
        }
        return (
            <ul class="flex flex-col my-2 space-y-4 text-slate-600">
                {Object.entries(dict).map(([key, value]) => (
                    (typeof value !== 'object' || value === null || Array.isArray(value)) ?
                        (
                            <li className='hover:text-slate-900 focus:text-slate-900'>
                                <a href={"/public/files/fizica/" + value.join("/")}>{value[value.length - 1]}</a>
                            </li>
                        ) : (
                            <li key={key}>
                                <p className='text-black'>{key.replace("-", " ") + ":"}</p>
                                {this.listDir(value)}
                            </li>
                        )
                ))}
            </ul>
        );
    }

    render() {
        return this.listDir(bac);
    }
}

export default MyComponent;
